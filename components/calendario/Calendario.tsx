"use client";

import { useMemo, useState } from "react";
import { Check, MessageCircle, TriangleAlert, X } from "lucide-react";

type Estado = "pendiente" | "confirmada" | "en_conflicto" | "cancelada";
type TipoRespuesta = "tambien_lo_necesito" | "no_lo_necesito" | "comentario";

interface Respuesta {
  id: string;
  usuarioNombre: string;
  tipo: TipoRespuesta;
  texto?: string;
  creadoEn: Date;
}

interface Reserva {
  id: string;
  autoId: string;
  usuarioNombre: string;
  inicio: Date;
  fin: Date;
  estado: Estado;
  comentario?: string;
  respuestas: Respuesta[];
}

interface Auto {
  id: string;
  nombre: string;
}

interface Usuario {
  nombre: string;
  color: string;
}

const AUTOS: Auto[] = [
  { id: "auto1", nombre: "Corolla" },
  { id: "auto2", nombre: "Fiesta" },
];

const USUARIOS: Usuario[] = [
  { nombre: "Nico", color: "var(--cal-series-1)" },
  { nombre: "Male", color: "var(--cal-series-2)" },
  { nombre: "Fede", color: "var(--cal-series-3)" },
];

const HORA_INICIO = 7;
const HORA_FIN = 23;
const ALTO_HORA = 56;

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

//lunes de la semana que contiene `fecha`
function inicioDeSemana(fecha: Date) {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sumarDias(fecha: Date, dias: number) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

function mismoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatoHora(fecha: Date) {
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

//formato HH:MM 24hs que espera el value de <input type="time">
function formatoHoraInput(fecha: Date) {
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

function seSolapan(r: Reserva, autoId: string, inicio: Date, fin: Date, excluirId?: string) {
  return r.id !== excluirId && r.autoId === autoId && r.estado !== "cancelada" && r.inicio < fin && r.fin > inicio;
}

//asigna a cada reserva una columna dentro de su grupo de solapadas, para
//dibujarlas lado a lado en vez de una tapando a la otra
function layoutReservas(reservas: Reserva[]) {
  const ordenadas = [...reservas].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const resultado = new Map<string, { col: number; cols: number }>();
  let cluster: Reserva[] = [];
  let clusterFin = -Infinity;

  function cerrarCluster() {
    if (cluster.length === 0) return;
    const finesPorColumna: number[] = [];
    for (const r of cluster) {
      let col = finesPorColumna.findIndex((fin) => fin <= r.inicio.getTime());
      if (col === -1) {
        col = finesPorColumna.length;
        finesPorColumna.push(r.fin.getTime());
      } else {
        finesPorColumna[col] = r.fin.getTime();
      }
      resultado.set(r.id, { col, cols: 0 });
    }
    const cols = finesPorColumna.length;
    for (const r of cluster) resultado.set(r.id, { col: resultado.get(r.id)!.col, cols });
    cluster = [];
    clusterFin = -Infinity;
  }

  for (const r of ordenadas) {
    if (cluster.length > 0 && r.inicio.getTime() >= clusterFin) cerrarCluster();
    cluster.push(r);
    clusterFin = Math.max(clusterFin, r.fin.getTime());
  }
  cerrarCluster();
  return resultado;
}

function reservaSemilla(
  id: string,
  autoId: string,
  usuarioNombre: string,
  base: Date,
  diaOffset: number,
  horaInicio: number,
  horaFin: number,
  estado: Estado,
  comentario?: string,
  respuestas: Respuesta[] = [],
): Reserva {
  const inicio = sumarDias(base, diaOffset);
  inicio.setHours(horaInicio, 0, 0, 0);
  const fin = sumarDias(base, diaOffset);
  fin.setHours(horaFin, 0, 0, 0);
  return { id, autoId, usuarioNombre, inicio, fin, estado, comentario, respuestas };
}

function reservasIniciales(base: Date): Reserva[] {
  return [
    reservaSemilla("r1", "auto1", "Male", base, 1, 9, 11, "confirmada", "voy al médico"),
    reservaSemilla("r2", "auto1", "Nico", base, 3, 18, 21, "en_conflicto", "junta con amigos", [
      { id: "x1", usuarioNombre: "Fede", tipo: "tambien_lo_necesito", creadoEn: new Date() },
    ]),
    reservaSemilla("r3", "auto1", "Fede", base, 3, 19, 22, "en_conflicto", "cena de laburo", [
      { id: "x2", usuarioNombre: "Nico", tipo: "comentario", texto: "yo lo necesito hasta las 21, ¿te sirve arrancar más tarde?", creadoEn: new Date() },
    ]),
    reservaSemilla("r4", "auto2", "Fede", base, 5, 10, 13, "confirmada"),
  ];
}

const ESTADO_INFO: Record<Estado, { label: string; color: string; Icono: typeof Check }> = {
  confirmada: { label: "Confirmada", color: "var(--cal-good)", Icono: Check },
  pendiente: { label: "Pendiente", color: "var(--cal-warning)", Icono: MessageCircle },
  en_conflicto: { label: "En conflicto", color: "var(--cal-critical)", Icono: TriangleAlert },
  cancelada: { label: "Cancelada", color: "var(--cal-cancelada)", Icono: X },
};

type Panel = { modo: "detalle"; reservaId: string } | { modo: "crear"; autoId: string; inicio: Date; fin: Date } | null;

export default function Calendario({ usuarioActual }: { usuarioActual: string }) {
  const [autoId, setAutoId] = useState(AUTOS[0].id);
  const [semanaBase, setSemanaBase] = useState(() => inicioDeSemana(new Date()));
  const [reservas, setReservas] = useState<Reserva[]>(() => reservasIniciales(inicioDeSemana(new Date())));
  const [panel, setPanel] = useState<Panel>(null);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semanaBase, i)), [semanaBase]);
  const horas = useMemo(() => Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i), []);

  const reservasDelAuto = reservas.filter((r) => r.autoId === autoId && r.estado !== "cancelada");

  function reconciliarConflictos(lista: Reserva[]) {
    return lista.map((r) => {
      if (r.estado !== "en_conflicto") return r;
      const sigueSolapada = lista.some((otra) => seSolapan(otra, r.autoId, r.inicio, r.fin, r.id));
      return sigueSolapada ? r : { ...r, estado: "confirmada" as Estado };
    });
  }

  function crearReserva(inicio: Date, fin: Date, comentario: string) {
    const solapadas = reservas.filter((r) => seSolapan(r, autoId, inicio, fin));
    const nueva: Reserva = {
      id: crypto.randomUUID(),
      autoId,
      usuarioNombre: usuarioActual,
      inicio,
      fin,
      estado: solapadas.length > 0 ? "en_conflicto" : "confirmada",
      comentario: comentario || undefined,
      respuestas: [],
    };
    setReservas((prev) => {
      const marcadas = prev.map((r) => (solapadas.some((s) => s.id === r.id) ? { ...r, estado: "en_conflicto" as Estado } : r));
      return [...marcadas, nueva];
    });
    setPanel({ modo: "detalle", reservaId: nueva.id });
  }

  function retirarReserva(id: string) {
    setReservas((prev) => reconciliarConflictos(prev.map((r) => (r.id === id ? { ...r, estado: "cancelada" as Estado } : r))));
    setPanel(null);
  }

  function agregarRespuesta(reservaId: string, tipo: TipoRespuesta, texto?: string) {
    setReservas((prev) =>
      prev.map((r) =>
        r.id === reservaId
          ? { ...r, respuestas: [...r.respuestas, { id: crypto.randomUUID(), usuarioNombre: usuarioActual, tipo, texto, creadoEn: new Date() }] }
          : r,
      ),
    );
  }

  const reservaPanel = panel?.modo === "detalle" ? reservas.find((r) => r.id === panel.reservaId) : null;
  const conflictoDelPanel = reservaPanel && reservaPanel.estado === "en_conflicto"
    ? reservas.filter((r) => seSolapan(r, reservaPanel.autoId, reservaPanel.inicio, reservaPanel.fin, reservaPanel.id))
    : [];

  return (
    <div className="flex h-dvh flex-col p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {AUTOS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAutoId(a.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                a.id === autoId ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"
              }`}
            >
              {a.nombre}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setSemanaBase((s) => sumarDias(s, -7))} className="rounded-md border border-border px-2 py-1">
            ←
          </button>
          <span className="min-w-40 text-center text-muted-foreground">
            {dias[0].toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} – {dias[6].toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
          </span>
          <button onClick={() => setSemanaBase((s) => sumarDias(s, 7))} className="rounded-md border border-border px-2 py-1">
            →
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-auto rounded-lg border border-border">
        <div className="relative grid flex-1" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
          <div className="sticky top-0 z-10 border-b border-r border-border bg-card" />
          {dias.map((d, i) => (
            <div key={i} className="sticky top-0 z-10 border-b border-r border-border bg-card p-2 text-center text-sm last:border-r-0">
              <div className="text-muted-foreground">{DIAS[i]}</div>
              <div className={mismoDia(d, new Date()) ? "font-semibold text-primary" : "font-medium"}>{d.getDate()}</div>
            </div>
          ))}

          {horas.map((h) => (
            <div key={h} className="contents">
              <div className="border-r border-t border-border px-1 pt-0.5 text-right text-xs text-muted-foreground" style={{ height: ALTO_HORA }}>
                {h}:00
              </div>
              {dias.map((d, i) => (
                <div key={i} className="relative border-r border-t border-border last:border-r-0" style={{ height: ALTO_HORA }} />
              ))}
            </div>
          ))}

          {dias.map((d, i) => (
            <div
              key={`click-${i}`}
              className="absolute cursor-pointer"
              style={{
                width: `calc((100% - 48px) / 7)`,
                left: `calc(48px + (100% - 48px) / 7 * ${i})`,
                top: 41,
                height: (HORA_FIN - HORA_INICIO) * ALTO_HORA,
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const horaDecimal = HORA_INICIO + y / ALTO_HORA;
                const horaRedondeada = Math.round(horaDecimal * 2) / 2;
                const inicio = new Date(d);
                inicio.setHours(Math.floor(horaRedondeada), horaRedondeada % 1 === 0.5 ? 30 : 0, 0, 0);
                const fin = new Date(inicio);
                fin.setHours(inicio.getHours() + 1);
                setPanel({ modo: "crear", autoId, inicio, fin });
              }}
            >
              {(() => {
                const reservasDelDia = reservasDelAuto.filter((r) => mismoDia(r.inicio, d));
                const layout = layoutReservas(reservasDelDia);
                return reservasDelDia.map((r) => {
                  const usuario = USUARIOS.find((u) => u.nombre === r.usuarioNombre);
                  const info = ESTADO_INFO[r.estado];
                  const top = (r.inicio.getHours() + r.inicio.getMinutes() / 60 - HORA_INICIO) * ALTO_HORA;
                  const alto = ((r.fin.getTime() - r.inicio.getTime()) / 3600000) * ALTO_HORA;
                  const { col, cols } = layout.get(r.id) ?? { col: 0, cols: 1 };
                  return (
                    <button
                      key={r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPanel({ modo: "detalle", reservaId: r.id });
                      }}
                      className="absolute overflow-hidden rounded-md border-l-4 bg-card p-1 text-left text-xs shadow-sm"
                      style={{
                        top,
                        height: Math.max(alto, 24),
                        left: `calc(${(100 / cols) * col}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        borderLeftColor: usuario?.color ?? "var(--cal-series-1)",
                      }}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <info.Icono size={12} color={info.color} />
                        {r.usuarioNombre}
                      </div>
                      <div className="text-muted-foreground">
                        {formatoHora(r.inicio)}–{formatoHora(r.fin)}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {USUARIOS.map((u) => (
          <span key={u.nombre} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: u.color }} />
            {u.nombre}
          </span>
        ))}
        <span className="mx-2 h-4 border-l border-border" />
        {(Object.keys(ESTADO_INFO) as Estado[]).map((e) => {
          const info = ESTADO_INFO[e];
          return (
            <span key={e} className="flex items-center gap-1">
              <info.Icono size={12} color={info.color} />
              {info.label}
            </span>
          );
        })}
      </div>

      {panel && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={() => setPanel(null)}>
          <div className="h-full w-full max-w-sm overflow-y-auto bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {panel.modo === "crear" && (
              <FormularioReserva
                autoNombre={AUTOS.find((a) => a.id === panel.autoId)?.nombre ?? ""}
                inicioInicial={panel.inicio}
                finInicial={panel.fin}
                onCancelar={() => setPanel(null)}
                onConfirmar={(inicio, fin, comentario) => crearReserva(inicio, fin, comentario)}
              />
            )}

            {panel.modo === "detalle" && reservaPanel && (
              <DetalleReserva
                reserva={reservaPanel}
                autoNombre={AUTOS.find((a) => a.id === reservaPanel.autoId)?.nombre ?? ""}
                conflicto={conflictoDelPanel}
                usuarioActual={usuarioActual}
                onCerrar={() => setPanel(null)}
                onRetirar={retirarReserva}
                onResponder={(tipo, texto) => agregarRespuesta(reservaPanel.id, tipo, texto)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioReserva({
  autoNombre,
  inicioInicial,
  finInicial,
  onCancelar,
  onConfirmar,
}: {
  autoNombre: string;
  inicioInicial: Date;
  finInicial: Date;
  onCancelar: () => void;
  onConfirmar: (inicio: Date, fin: Date, comentario: string) => void;
}) {
  const [horaInicio, setHoraInicio] = useState(formatoHoraInput(inicioInicial));
  const [horaFin, setHoraFin] = useState(formatoHoraInput(finInicial));
  const [comentario, setComentario] = useState("");

  function confirmar() {
    const [hi, mi] = horaInicio.split(":").map(Number);
    const [hf, mf] = horaFin.split(":").map(Number);
    const inicio = new Date(inicioInicial);
    inicio.setHours(hi, mi, 0, 0);
    const fin = new Date(inicioInicial);
    fin.setHours(hf, mf, 0, 0);
    onConfirmar(inicio, fin, comentario);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Nueva reserva</h2>
        <button onClick={onCancelar}>
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {autoNombre} · {inicioInicial.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "short" })}
      </p>
      <div className="flex gap-2">
        <label className="flex-1 text-sm">
          Desde
          <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2" />
        </label>
        <label className="flex-1 text-sm">
          Hasta
          <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2" />
        </label>
      </div>
      <label className="text-sm">
        Comentario (opcional)
        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2" rows={2} />
      </label>
      <button onClick={confirmar} className="rounded-md bg-primary p-2 text-sm font-medium text-primary-foreground">
        Reservar
      </button>
    </div>
  );
}

function DetalleReserva({
  reserva,
  autoNombre,
  conflicto,
  usuarioActual,
  onCerrar,
  onRetirar,
  onResponder,
}: {
  reserva: Reserva;
  autoNombre: string;
  conflicto: Reserva[];
  usuarioActual: string;
  onCerrar: () => void;
  onRetirar: (id: string) => void;
  onResponder: (tipo: TipoRespuesta, texto?: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const info = ESTADO_INFO[reserva.estado];
  const esPropia = reserva.usuarioNombre === usuarioActual;

  const hilo = [reserva, ...conflicto]
    .flatMap((r) => r.respuestas.map((resp) => ({ ...resp, deReservaDe: r.usuarioNombre })))
    .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{autoNombre}</h2>
        <button onClick={onCerrar}>
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: info.color }}>
        <info.Icono size={16} />
        {info.label}
      </div>

      <div className="rounded-md border border-border p-2 text-sm">
        <div className="font-medium">{reserva.usuarioNombre}</div>
        <div className="text-muted-foreground">
          {reserva.inicio.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "short" })} · {formatoHora(reserva.inicio)}–{formatoHora(reserva.fin)}
        </div>
        {reserva.comentario && <div className="mt-1">{reserva.comentario}</div>}
      </div>

      {esPropia && reserva.estado !== "cancelada" && (
        <button onClick={() => onRetirar(reserva.id)} className="self-start rounded-md border border-border px-2 py-1 text-xs">
          Retirar mi reserva
        </button>
      )}

      {conflicto.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">También lo pidieron:</p>
          {conflicto.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <span>
                {r.usuarioNombre} · {formatoHora(r.inicio)}–{formatoHora(r.fin)}
              </span>
              {r.usuarioNombre === usuarioActual && (
                <button onClick={() => onRetirar(r.id)} className="rounded-md border border-border px-2 py-1 text-xs">
                  Retirar mi reserva
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!esPropia && reserva.estado === "en_conflicto" && (
        <button onClick={() => onResponder("tambien_lo_necesito")} className="self-start rounded-md border border-border px-2 py-1 text-xs">
          También lo necesito
        </button>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-sm font-medium">Comentarios</p>
        {hilo.length === 0 && <p className="text-xs text-muted-foreground">Sin comentarios todavía.</p>}
        {hilo.map((r) => (
          <div key={r.id} className="text-sm">
            <span className="font-medium">{r.usuarioNombre}</span>
            {r.tipo === "tambien_lo_necesito" && <span className="text-muted-foreground"> también lo necesita</span>}
            {r.tipo === "no_lo_necesito" && <span className="text-muted-foreground"> no lo necesita</span>}
            {r.texto && <span className="text-muted-foreground">: {r.texto}</span>}
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribir un comentario..."
            className="flex-1 rounded-md border border-border bg-background p-2 text-sm"
          />
          <button
            onClick={() => {
              if (!texto.trim()) return;
              onResponder("comentario", texto.trim());
              setTexto("");
            }}
            className="rounded-md border border-border px-3 text-sm"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
