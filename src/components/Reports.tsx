import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Tabs, TabsList, TabsTrigger, TabsContent
} from "@/components/ui/tabs"; 
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import {
  Card, CardContent
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Reports() {
  const [data, setData] = useState<any[]>([]);
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState<string[]>([]);
  const [semanasSeleccionadas, setSemanasSeleccionadas] = useState<number[]>([]);
  const [sectoresDisponibles, setSectoresDisponibles] = useState<string[]>([]);
  const [semanasDisponibles, setSemanasDisponibles] = useState<number[]>([]);
  const semanasSeleccionadasOrdenadas = [...semanasSeleccionadas].sort((a, b) => a - b);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 rounded shadow text-black text-sm">
          <p className="font-bold">Semana: {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    async function fetchSectoresYSemanas() {
      const { data: allData, error } = await supabase
        .from("Muestreos Nutricion")
        .select("Sector, Semana")
        .range(0, 9999);

      if (!error && allData) {
        const sectores = [...new Set(allData.map(d => d.Sector))].sort((a, b) => {
          const [an, al] = [parseInt(a), a.slice(-1)];
          const [bn, bl] = [parseInt(b), b.slice(-1)];
          return an - bn || al.localeCompare(bl);
        });
        const semanas = [...new Set(allData.map(d => d.Semana))].sort((a, b) => b - a);
        setSectoresDisponibles(sectores);
        setSemanasDisponibles(semanas);
      }
    }
    fetchSectoresYSemanas();
  }, []);

  useEffect(() => {
    async function fetchData() {
      let query = supabase
        .from("Muestreos Nutricion")
        .select("*")
        .order("Fecha", { ascending: false })
        .limit(10000);

      if (semanasSeleccionadas.length > 0) {
        query = query.in("Semana", semanasSeleccionadas);
      }

      if (sectoresSeleccionados.length > 0) {
        query = query.in("Sector", sectoresSeleccionados);
      }

      const { data, error } = await query;
      if (!error && data) {
        setData(data);
      } else {
        console.error("Error al obtener datos:", error);
      }
    }
    fetchData();
  }, [sectoresSeleccionados, semanasSeleccionadas]);

  const calcularPromedios = (entries: any[]) => {
    const porFecha: { [fecha: string]: { [sector: string]: any[] } } = {};
    entries.forEach((d) => {
      if (!porFecha[d.Fecha]) porFecha[d.Fecha] = {};
      if (!porFecha[d.Fecha][d.Sector]) porFecha[d.Fecha][d.Sector] = [];
      porFecha[d.Fecha][d.Sector].push(d);
    });

    return Object.entries(porFecha).map(([fecha, sectores]) => {
      const sectoresArray = Object.entries(sectores).map(([sector, group]) => ({
        sector,
        entradas: group
      }));

      const allEntries = sectoresArray.flatMap(s => s.entradas);
      const tipos = ["Goteros", "Exprimidos"];
      const totalPorTipo = tipos.map(tipo => {
        const filtrados = allEntries.filter(e => e.Tipo === tipo);
        if (filtrados.length === 0) return null;
        const prom = (key: string) => (filtrados.reduce((sum, r) => sum + r[key], 0) / filtrados.length).toFixed(2);
        return {
          tipo,
          Prom_CE: prom("C.E."),
          Prom_pH: prom("pH"),
          Prom_NO3: prom("NO3"),
          Prom_Ca: prom("Ca"),
          Prom_K: prom("K"),
          Prom_Na: prom("Na")
        };
      }).filter(Boolean);

      return {
        fecha,
        sectores: sectoresArray,
        total: totalPorTipo
      };
    });
  };

  const resumenPorFechaYSector = calcularPromedios(data);

  const datosGrafica = resumenPorFechaYSector.flatMap((r) =>
    r.total.map((t: any) => ({
      semana: r.sectores[0].entradas[0].Semana, // Usa Semana del primer entry (todos igual)
      ...t
    }))
  );

  return (
    <div className="p-6 space-y-4 bg-zinc-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold">Reportes de Nutrición</h1>

      <div className="flex gap-10 flex-wrap items-start">
        <div className="bg-zinc-800 text-white border border-zinc-700 px-4 py-2 rounded-md max-w-[400px]">
          <p className="text-xl font-bold">Sectores:</p>
          <div className="grid grid-cols-6 gap-1 max-h-[100px] overflow-y-auto">
            {sectoresDisponibles.map((sec) => (
              <label key={sec} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={sectoresSeleccionados.includes(sec)}
                  onChange={() => {
                    if (sectoresSeleccionados.includes(sec)) {
                      setSectoresSeleccionados(prev => prev.filter(s => s !== sec));
                    } else {
                      setSectoresSeleccionados(prev => [...prev, sec]);
                    }
                  }}
                />
                <span>{sec}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-zinc-800 text-white border border-zinc-700 px-5 py-2 rounded-md max-w-[300px]">
          <p className="text-xl font-bold mb-1">Semanas:</p>
          <div className="grid grid-cols-6 gap-1 max-h-[100px] overflow-y-auto text-sm">
            {semanasDisponibles.map((w) => (
              <label key={w} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={semanasSeleccionadas.includes(w)}
                  onChange={() => {
                    setSemanasSeleccionadas((prev) =>
                      prev.includes(w) ? prev.filter((s) => s !== w) : [...prev, w]
                    );
                  }}
                />
                <span>{w}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="tabla">
        <TabsList className="mt-4 bg-zinc-800 border border-zinc-700 text-white">
          <TabsTrigger value="tabla" className="data-[state=active]:bg-blue-600 px-4 py-2 rounded-l-md">Tabla</TabsTrigger>
          <TabsTrigger value="grafica" className="data-[state=active]:bg-blue-600 px-4 py-2 rounded-r-md">Gráfica</TabsTrigger>
        </TabsList>

        <TabsContent value="tabla">
          {resumenPorFechaYSector.map(({ fecha, sectores, total }, idx) => (
            <Card key={idx} className="mt-6 bg-zinc-800 border border-zinc-700 text-white">
              <div className="bg-zinc-900 px-5 py-3 rounded-t-md border-b border-zinc-700"> 
                <p className="text-2xl font-bold">Promedios del {fecha}</p>
              </div>
              <CardContent className="pt-2">
                {sectores.map(({ sector, entradas }, j) => (
                  <div key={j} className="mb-6">
                    <p className="text-xl font-semibold">Sector {sector}</p>
                    <Table className="mt-1 text-base">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Prom C.E.</TableHead>
                          <TableHead>Prom pH</TableHead>
                          <TableHead>Prom NO3</TableHead>
                          <TableHead>Prom Ca</TableHead>
                          <TableHead>Prom K</TableHead>
                          <TableHead>Prom Na</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {["Goteros", "Exprimidos"].map(tipo => {
                          const filtrados = entradas.filter(e => e.Tipo === tipo);
                          if (filtrados.length === 0) return null;
                          const prom = (key: string) => (filtrados.reduce((sum, r) => sum + r[key], 0) / filtrados.length).toFixed(2);
                          return (
                            <TableRow key={tipo} className="text-base"> 
                              <TableCell>{tipo}</TableCell>
                              <TableCell>{prom("C.E.")}</TableCell>
                              <TableCell>{prom("pH")}</TableCell>
                              <TableCell>{prom("NO3")}</TableCell>
                              <TableCell>{prom("Ca")}</TableCell>
                              <TableCell>{prom("K")}</TableCell>
                              <TableCell>{prom("Na")}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="mt-4">
                      <p className="text-xl font-semibold">Valores individuales</p>
                      <Table className="mt-1 text-base">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-base">Tipo</TableHead>
                            <TableHead className="text-base">C.E.</TableHead>
                            <TableHead className="text-base">pH</TableHead>
                            <TableHead className="text-base">NO3</TableHead>
                            <TableHead className="text-base">Ca</TableHead>
                            <TableHead className="text-base">K</TableHead>
                            <TableHead className="text-base">Na</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entradas.map((e, i) => (
                            <TableRow key={i} className="text-base">
                              <TableCell className="text-base">{e.Tipo}</TableCell>
                              <TableCell className="text-base">{e["C.E."].toFixed(2)}</TableCell>
                              <TableCell className="text-base">{e.pH.toFixed(2)}</TableCell>
                              <TableCell className="text-base">{e.NO3.toFixed(0)}</TableCell>
                              <TableCell className="text-base">{e.Ca.toFixed(0)}</TableCell>
                              <TableCell className="text-base">{e.K.toFixed(0)}</TableCell>
                              <TableCell className="text-base">{e.Na.toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}

                {total.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xl font-semibold">Total</p>
                    <Table className="text-base">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Prom C.E.</TableHead>
                          <TableHead>Prom pH</TableHead>
                          <TableHead>Prom NO3</TableHead>
                          <TableHead>Prom Ca</TableHead>
                          <TableHead>Prom K</TableHead>
                          <TableHead>Prom Na</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {total.map((t, i) => (
                          <TableRow key={i} className="text-base">
                            <TableCell>{t.tipo}</TableCell>
                            <TableCell>{t.Prom_CE}</TableCell>
                            <TableCell>{t.Prom_pH}</TableCell>
                            <TableCell>{t.Prom_NO3}</TableCell>
                            <TableCell>{t.Prom_Ca}</TableCell>
                            <TableCell>{t.Prom_K}</TableCell>
                            <TableCell>{t.Prom_Na}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent> 
            </Card>
          ))}
        </TabsContent> 

        <TabsContent value="grafica">
          <Card className="bg-zinc-800 border border-zinc-700 p-4 mt-6 text-white">
            <p className="text-xl font-semibold mb-2">Histórico de pH</p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={datosGrafica}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="semana"
                  type="category"
                  ticks={semanasSeleccionadasOrdenadas}
                  interval={0}
                  label={{ value: "Semana", position: "insideBottom", offset: -5 }}
                  tick={{ fill: "#ccc", fontSize: 12 }}
                  tickFormatter={(value) => value} // Muestra solo el número (29, 28, etc.)
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="Prom_pH" stroke="#10b981" name="pH" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="bg-zinc-800 border border-zinc-700 p-4 mt-6 text-white">
            <p className="text-xl font-semibold mb-2">Histórico de C.E.</p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={datosGrafica}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="semana"
                  type="category"
                  ticks={semanasSeleccionadasOrdenadas}
                  interval={0}
                  label={{ value: "Semana", position: "insideBottom", offset: -5 }}
                  tick={{ fill: "#ccc", fontSize: 12 }}
                  tickFormatter={(value) => value} // Muestra solo el número (29, 28, etc.)
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="Prom_CE" stroke="#3b82f6" name="C.E." />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {[
            { key: "Prom_NO3", color: "#fbbf24", label: "NO3" },
            { key: "Prom_Ca", color: "#ef4444", label: "Ca" },
            { key: "Prom_K", color: "#8b5cf6", label: "K" },
            { key: "Prom_Na", color: "#f472b6", label: "Na" },
          ].map(({ key, color, label }) => (
            <Card key={key} className="bg-zinc-800 border border-zinc-700 p-4 mt-6 text-white">
              <p className="text-xl font-semibold mb-2">Histórico de {label}</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={datosGrafica}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="semana"
                    type="category"
                    ticks={semanasSeleccionadasOrdenadas}
                    interval={0}
                    label={{ value: "Semana", position: "insideBottom", offset: -5 }}
                    tick={{ fill: "#ccc", fontSize: 12 }}
                    tickFormatter={(value) => value} // Muestra solo el número (29, 28, etc.)
                  />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey={key} stroke={color} name={label} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}