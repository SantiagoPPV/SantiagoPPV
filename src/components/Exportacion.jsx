import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "../lib/supabaseClient";
// ── Permisos (Fase 8) ─────────────────────────────────────────────────────────
import { usePermissionsForJSX } from "../hooks/usePermissionsForJSX";
import ApprovalRequestModalJSX from "./configuracion/ApprovalRequestModalJSX";

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const T = {
  bg: "#060b12", surface: "#09111c", card: "#0c1825", cardHov: "#101f30",
  border: "#162035", borderLt: "#1e2f47",
  teal: "#00c9a7", tealDim: "#00c9a712", amber: "#f5a623",
  blue: "#4d9fff", orange: "#ff7940", green: "#22d07a",
  red: "#ff4d6d", purple: "#a78bfa",
  txt1: "#dde6f0", txt2: "#7a97b8", txt3: "#3d5470",
  mono: "'Courier New','Lucida Console',monospace",
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES DEL DOMINIO
═══════════════════════════════════════════════════════════════ */
const STAGES = [
  { id: "cooler",    name: "Cooler / Docs",  icon: "❄️📋", color: T.teal   },
  { id: "cruce",     name: "Cruce Frontera", icon: "🛃",   color: T.orange },
  { id: "transito",  name: "Tránsito US",    icon: "🚛",   color: T.blue   },
  { id: "entregado", name: "Entregado",      icon: "✅",   color: T.green  },
];
// Alias de compatibilidad: embarques con status "documentacion" en DB → se tratan como "cooler"
const STAGE_ALIAS = { documentacion: "cooler" };

const DOCS_REQUERIDOS = {
  cooler: [
    { key: "factura_xml",         label: "Factura CFDI (.xml)",               req: true,  icon: "🗂" },
    { key: "factura_pdf",         label: "Factura CFDI (.pdf)",               req: true,  icon: "📄" },
    { key: "carta_porte",         label: "Carta Porte 3.1",                   req: true,  icon: "📋" },
    { key: "packing_list",        label: "Packing List",                      req: true,  icon: "📊" },
    { key: "fda_prior_notice",    label: "FDA Prior Notice",                  req: true,  icon: "🇺🇸" },
    { key: "carta_instrucciones", label: "Carta de Instrucciones al Agente",  req: true,  icon: "✉️" },
    { key: "tmec",                label: "Cert. de Origen T-MEC (Forma 434)", req: false, icon: "🤝" },
  ],
  cruce: [
    { key: "pedimento",     label: "Pedimento de Exportación A1",            req: true, icon: "📑" },
    { key: "manifiesto",    label: "Manifiesto de Exportación (CBP 7533)",   req: true, icon: "🗃" },
    { key: "entry_summary", label: "Entry Summary (CBP Form 7501)",          req: true, icon: "📃" },
  ],
  transito: [
    { key: "bill_of_lading",    label: "Bill of Lading",    req: true, icon: "🚛" },
    { key: "shipping_register", label: "Shipping Register", req: true, icon: "📋" },
  ],
  entregado: [
    { key: "pod", label: "Proof of Delivery (POD)", req: true, icon: "✅" },
  ],
};

// Todos los docs planos para el compositor de correos
const ALL_DOCS_FLAT = Object.values(DOCS_REQUERIDOS).flat();

/* ── EMAIL TEMPLATES ─────────────────────────────────────────── */
const EMAIL_TEMPLATES = [
  {
    id: "aviso_salida",
    nombre: "🚀 Aviso de Salida del Embarque",
    asunto: "{{codigo}} – {{fecha_larga}}",
    roles: ["interno","trafico","agente_mx","agente_us","cliente","warehouse"],
    adjuntos_sugeridos: [],
    body: `Hola, buen día. Comparto información de la salida de hoy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMEN DEL EMBARQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cajas:             {{cajas_total}}
Presentación:      {{presentacion}}
Cajas por Pallet:  {{cajas_por_pallet}}
KG Neto:           {{kg_total}} kg
Pallets:           {{num_pallets}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESTINATARIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{destinatario_nombre}}
{{destinatario_direccion}}
Tel: {{destinatario_telefono}}
Tax ID: {{destinatario_tax_id}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSPORTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tracto: {{tracto_marca}} / Placa {{tracto_placa}}
Remolque: {{remolque_marca}} / Placa {{remolque_placa}}
Thermo: {{thermo}}
Operador: {{operador}} | CAAT: {{caat}} | Alpha: {{alpha}}

Horario de salida: {{hora_salida}} hs

En un momento envío la factura.

Saludos`,
  },
  {
    id: "anexo_factura",
    nombre: "🧾 Anexo Factura",
    asunto: "Anexo Factura – {{codigo}} {{fecha_larga}}",
    roles: ["interno","trafico","agente_mx","agente_us","cliente"],
    adjuntos_sugeridos: ["factura_xml","factura_pdf"],
    body: `Buen día, adjunto la factura del embarque {{codigo}}.

Fecha: {{fecha_salida}}
Pallets: {{num_pallets}} | Cajas: {{cajas_total}} | KG: {{kg_total}} kg

Saludos`,
  },
  {
    id: "docs_agente_mx",
    nombre: "📋 Documentos para Agente Aduanal MX",
    asunto: "Docs Exportación – {{codigo}} – Cruce {{fecha_salida}}",
    roles: ["agente_mx","interno"],
    adjuntos_sugeridos: ["factura_xml","factura_pdf","packing_list","carta_instrucciones","fitosanitario","tmec"],
    body: `Buen día, adjunto documentación para despacho de exportación.

Embarque: {{codigo}}
Fecha de cruce estimada: {{fecha_salida}}
Pallets: {{num_pallets}} | KG: {{kg_total}} kg

Destino final: {{destinatario_nombre}}, {{destinatario_direccion}}

Por favor confirmar recepción y avisar cualquier observación.

Saludos`,
  },
  {
    id: "aviso_cruce",
    nombre: "🛃 Aviso de Cruce a Agente US",
    asunto: "Cruce en Camino – {{codigo}} – {{fecha_salida}}",
    roles: ["agente_us","trafico","interno"],
    adjuntos_sugeridos: ["factura_pdf","packing_list","pedimento"],
    body: `Buen día, el embarque {{codigo}} está en camino a frontera.

Fecha de cruce estimada: {{fecha_salida}}
Pallets: {{num_pallets}} | Cajas: {{cajas_total}}
Tracto: {{tracto_placa}} | Operador: {{operador}}

Destino: {{destinatario_nombre}}
{{destinatario_direccion}}

Por favor confirmar proceso de entrada y avisar número de pedimento US.

Saludos`,
  },
  {
    id: "alerta_incidencia",
    nombre: "⚠️ Alerta de Incidencia",
    asunto: "⚠️ INCIDENCIA – {{codigo}} – {{fecha_salida}}",
    roles: ["interno","trafico","cliente","agente_mx","agente_us"],
    adjuntos_sugeridos: [],
    body: `Alerta: se ha detectado una incidencia en el embarque {{codigo}}.

Embarque: {{codigo}}
Fecha: {{fecha_salida}}
Pallets: {{num_pallets}}

DESCRIPCIÓN DE LA INCIDENCIA:
[Detallar aquí el problema detectado]

ACCIÓN REQUERIDA:
[Detallar aquí qué se necesita]

Favor de responder a la brevedad.

Saludos`,
  },
];

const CALIBRES      = ["LARGE","JUMBO","SMALL"];
const LABELS        = ["RIVER RUN","TWIN RIVER","AZRA","STANDARD","PREMIUM"];
const PRESENTACIONES= ["8X18","12X18","6X18","11X18"];
const KG_POR_CAJA   = { "8X18":4.2, "12X18":6.3, "6X18":2.1, "11X18":3.8 };
const VARIEDADES    = ["Biloxi","Snowchaser","Emerald","Star","O'Neal","Legacy"];
const ROL_LABELS    = { agente_mx:"Agente MX",agente_us:"Agente US",transportista:"Transportista",cliente:"Cliente",warehouse:"Warehouse",trafico:"Tráfico",interno:"Interno" };
const ROL_COLORS    = { agente_mx:T.orange,agente_us:T.blue,transportista:T.purple,cliente:T.teal,warehouse:T.green,trafico:T.amber,interno:T.txt2 };

/* ═══════════════════════════════════════════════════════════════
   DATOS INICIALES
═══════════════════════════════════════════════════════════════ */
const initialEmbarques = [
  {
    id:"e1", codigo:"AM26005RB", fecha_salida:"2026-02-20", hora_salida:"00:30",
    status:"transito",
    tracto_marca:"Marca Internacional", tracto_placa:"90-BG-1X",
    remolque_marca:"Utility", remolque_placa:"13-UW-1E",
    thermo:"412", operador:"Antonio Ávalos", caat:"36ZN", alpha:"TEPA", sello:"", notas:"",
    destinos:[{ id:"d1a",orden:1,cliente:"Family Tree Farms Marketing LLC",cust_po:"AM26005RB",warehouse:"Rio Bravo Packing & Logistics",direccion:"5316 S Stewart Rd, San Juan, TX 78589",telefono:"(956) 843-6200",tax_id:"",fecha_entrega_est:"2026-02-21",fecha_entrega_real:null }],
    pallets:[
      { id:"p1",tag:"2363298",lote:"AM26004RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-17",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:1.2,variedad:"Biloxi" },
      { id:"p2",tag:"2363299",lote:"AM26004RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-17",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:1.1,variedad:"Biloxi" },
      { id:"p3",tag:"2363300",lote:"AM26004RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-17",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:1.3,variedad:"Biloxi" },
      { id:"p4",tag:"2363301",lote:"AM26004RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-17",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:1.0,variedad:"Biloxi" },
      { id:"p5",tag:"2363302",lote:"AM26004RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-17",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:1.2,variedad:"Biloxi" },
      { id:"p6",tag:"2363509",lote:"AM26004RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-19",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:1.1,variedad:"Biloxi" },
    ],
    documentos:{
      factura_xml:{ status:"subido",nombre:"AM26005RB_factura.xml",   size:"24 KB", fecha:"2026-02-19" },
      factura_pdf:{ status:"subido",nombre:"AM26005RB_factura.pdf",   size:"112 KB",fecha:"2026-02-19" },
      carta_porte:{ status:"subido",nombre:"CartaPorte_AM26005RB.pdf",size:"88 KB", fecha:"2026-02-19" },
      packing_list:{ status:"subido",nombre:"PackingList_AM26005RB.pdf",size:"64 KB",fecha:"2026-02-19"},
      fitosanitario:{ status:"subido",nombre:"Fitosanitario_Feb2026.pdf",size:"1.2 MB",fecha:"2026-02-18"},
      fda_prior_notice:{ status:"subido",nombre:"PriorNotice_AM26005RB.pdf",size:"45 KB",fecha:"2026-02-20"},
      aphis:{ status:"subido",nombre:"APHIS_permit_2026.pdf",size:"320 KB",fecha:"2026-02-01"},
      carta_instrucciones:{ status:"subido",nombre:"CartaInstrucciones_AM26005RB.pdf",size:"52 KB",fecha:"2026-02-19"},
      pedimento:{ status:"subido",nombre:"Pedimento_A1_AM26005RB.pdf",size:"180 KB",fecha:"2026-02-20"},
      manifiesto:{ status:"subido",nombre:"Manifiesto_CBP7533_AM26005RB.pdf",size:"96 KB",fecha:"2026-02-20"},
      entry_summary:{ status:"subido",nombre:"CBP7501_AM26005RB.pdf",size:"72 KB",fecha:"2026-02-20"},
      bill_of_lading:{ status:"subido",nombre:"BillOfLading_AM26005RB.pdf",size:"140 KB",fecha:"2026-02-20"},
      shipping_register:{ status:"subido",nombre:"ShippingRegister_606795.pdf",size:"88 KB",fecha:"2026-02-20"},
    },
    correos:[
      { id:"m1",plantilla_id:"aviso_salida",asunto:"AM26005RB – Viernes 20 Febrero 2026",destinatarios:["exportacion@agricolamoray.com","trafico@agsalogistics.com"],adjuntos:[],enviado_at:"2026-02-20 01:15",enviado_por:"Nayeli G.",body:"Hola, buen día. Comparto información de la salida de hoy...",status:"enviado" },
      { id:"m2",plantilla_id:"anexo_factura",asunto:"Anexo Factura – AM26005RB Viernes 20 Febrero 2026",destinatarios:["exportacion@agricolamoray.com","trafico@agsalogistics.com"],adjuntos:["factura_xml","factura_pdf"],enviado_at:"2026-02-20 01:45",enviado_por:"Nayeli G.",body:"Buen día, adjunto la factura del embarque AM26005RB.",status:"enviado" },
    ],
    tracking:[
      { id:"t1",etapa:"cooler",fecha:"2026-02-18 08:00",usuario:"Nayeli G.",temp:1.2,notas:"Fruta recibida OK. 6 pallets." },
      { id:"t2",etapa:"documentacion",fecha:"2026-02-19 10:30",usuario:"Nayeli G.",temp:null,notas:"Documentación completa. Lista para despacho." },
      { id:"t3",etapa:"cruce",fecha:"2026-02-19 22:00",usuario:"Nayeli G.",temp:null,notas:"En garita Hidalgo TX." },
      { id:"t4",etapa:"transito",fecha:"2026-02-20 04:15",usuario:"Sistema",temp:0.8,notas:"Cruce exitoso. En camino a San Juan TX." },
    ],
  },
  {
    id:"e2", codigo:"AMO008", fecha_salida:"2026-02-20", hora_salida:"00:30",
    status:"cooler",
    tracto_marca:"Marca Internacional", tracto_placa:"90-BG-1X",
    remolque_marca:"Utility", remolque_placa:"13-UW-1E",
    thermo:"412", operador:"Antonio Ávalos", caat:"36ZN", alpha:"TEPA", sello:"", notas:"",
    destinos:[{ id:"d2a",orden:1,cliente:"Five Brothers Jalisco Produce, Co. Inc",cust_po:"AMO008",warehouse:"Five Brothers Jalisco Produce",direccion:"9000 Seguin Dr. Pharr, TX 78577",telefono:"(956) 781-8700",tax_id:"222849235",fecha_entrega_est:"2026-02-21",fecha_entrega_real:null }],
    pallets:[
      { id:"p7",tag:"2363510",lote:"AMO007",presentacion:"12X18",label:"TWIN RIVER",calibre:"LARGE",fecha:"2026-02-19",cajas:100,kg_neto:544.3,kg_bruto:553.0,temp_carga:1.5,variedad:"Snowchaser" },
      { id:"p8",tag:"2363511",lote:"AMO007",presentacion:"12X18",label:"TWIN RIVER",calibre:"LARGE",fecha:"2026-02-19",cajas:100,kg_neto:544.3,kg_bruto:553.0,temp_carga:1.4,variedad:"Snowchaser" },
      { id:"p9",tag:"2363512",lote:"AMO007",presentacion:"12X18",label:"TWIN RIVER",calibre:"LARGE",fecha:"2026-02-19",cajas:100,kg_neto:544.3,kg_bruto:553.0,temp_carga:1.6,variedad:"Snowchaser" },
    ],
    documentos:{
      factura_xml:{ status:"subido",nombre:"AMO008_factura.xml",size:"22 KB",fecha:"2026-02-20" },
      factura_pdf:{ status:"subido",nombre:"AMO008_factura.pdf",size:"108 KB",fecha:"2026-02-20" },
      fitosanitario:{ status:"subido",nombre:"Fitosanitario_Feb2026.pdf",size:"1.2 MB",fecha:"2026-02-18" },
      aphis:{ status:"subido",nombre:"APHIS_permit_2026.pdf",size:"320 KB",fecha:"2026-02-01" },
    },
    correos:[],
    tracking:[
      { id:"t5",etapa:"cooler",fecha:"2026-02-19 14:00",usuario:"Nayeli G.",temp:1.5,notas:"3 pallets recibidos. Calidad buena." },
      { id:"t6",etapa:"documentacion",fecha:"2026-02-20 06:00",usuario:"Nayeli G.",temp:null,notas:"Iniciando documentación para despacho." },
    ],
  },
  {
    id:"e3", codigo:"AM26003RB", fecha_salida:"2026-02-14", hora_salida:"01:00",
    status:"entregado",
    tracto_marca:"Kenworth", tracto_placa:"TRK-XZ9", remolque_marca:"Great Dane", remolque_placa:"GD-441B",
    thermo:"388", operador:"Carlos Mendoza", caat:"29AB", alpha:"SONORA", sello:"4421-B", notas:"Entrega sin incidencias.",
    destinos:[{ id:"d3a",orden:1,cliente:"Family Tree Farms Marketing LLC",cust_po:"AM26003RB",warehouse:"Rio Bravo Packing & Logistics",direccion:"5316 S Stewart Rd, San Juan, TX 78589",telefono:"(956) 843-6200",tax_id:"",fecha_entrega_est:"2026-02-16",fecha_entrega_real:"2026-02-16" }],
    pallets:Array.from({length:12},(_,i)=>({ id:`p${10+i}`,tag:`236310${i}`,lote:"AM26002RB",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"2026-02-13",cajas:144,kg_neto:607.2,kg_bruto:615.0,temp_carga:0.9,variedad:"Biloxi" })),
    documentos:Object.fromEntries(ALL_DOCS_FLAT.map(d=>[d.key,{status:"subido",nombre:`${d.key}_AM26003RB.pdf`,size:"95 KB",fecha:"2026-02-14"}])),
    correos:[
      { id:"m3",plantilla_id:"aviso_salida",asunto:"AM26003RB – Sábado 14 Febrero 2026",destinatarios:["exportacion@agricolamoray.com","shippingsj@riobravopl.com"],adjuntos:[],enviado_at:"2026-02-14 01:20",enviado_por:"Nayeli G.",body:"Hola, buen día. Comparto información...",status:"enviado" },
    ],
    tracking:[
      { id:"t7",etapa:"cooler",fecha:"2026-02-13 09:00",usuario:"Nayeli G.",temp:1.0,notas:"12 pallets recibidos OK." },
      { id:"t8",etapa:"documentacion",fecha:"2026-02-14 08:00",usuario:"Nayeli G.",temp:null,notas:"Docs completos." },
      { id:"t9",etapa:"cruce",fecha:"2026-02-14 23:30",usuario:"Nayeli G.",temp:null,notas:"Cruzando por Hidalgo." },
      { id:"t10",etapa:"transito",fecha:"2026-02-15 03:00",usuario:"Sistema",temp:0.7,notas:"En ruta a San Juan TX." },
      { id:"t11",etapa:"entregado",fecha:"2026-02-16 11:20",usuario:"Nayeli G.",temp:null,notas:"POD firmado. Recibido sin novedad." },
    ],
  },
];

const initialDestinos=[
  { id:"cat1",nombre:"Rio Bravo Packing & Logistics",direccion:"5316 S Stewart Rd",ciudad:"San Juan",estado:"TX",cp:"78589",telefono:"(956) 843-6200",tax_id:"",email:"shippingsj@riobravopl.com" },
  { id:"cat2",nombre:"Five Brothers Jalisco Produce, Co. Inc",direccion:"9000 Seguin Dr",ciudad:"Pharr",estado:"TX",cp:"78577",telefono:"(956) 781-8700",tax_id:"222849235",email:"" },
  { id:"cat3",nombre:"Twin River South LLC",direccion:"525 SW 6th Ave",ciudad:"Portland",estado:"OR",cp:"97204",telefono:"",tax_id:"",email:"" },
];

const initialContactos=[
  { id:"c1",nombre:"Exportación Moray",empresa:"Agricola Moray",rol:"interno",  email:"exportacion@agricolamoray.com",  es_fijo:true, activo:true },
  { id:"c2",nombre:"Tráfico Moray",    empresa:"Agricola Moray",rol:"trafico",  email:"trafico@agricolamoray.com",      es_fijo:true, activo:true },
  { id:"c3",nombre:"AGSA Logistics",   empresa:"AGSA",          rol:"agente_mx",email:"trafico@agsalogistics.com",      es_fijo:true, activo:true },
  { id:"c4",nombre:"Adolfo",           empresa:"Agricola Moray",rol:"interno",  email:"adolfo@agricolamoray.com",       es_fijo:false,activo:true },
  { id:"c5",nombre:"José Carmona",     empresa:"Rio Bravo",     rol:"agente_us",email:"jose.carmona@riobravopl.com",    es_fijo:false,activo:true },
  { id:"c6",nombre:"Shipping SJ",      empresa:"Rio Bravo",     rol:"warehouse",email:"shippingsj@riobravopl.com",      es_fijo:false,activo:true },
  { id:"c7",nombre:"Patricio Ramírez", empresa:"Rio Bravo",     rol:"agente_us",email:"patricio.ramirez@riobravopl.com",es_fijo:false,activo:true },
];

/* ═══════════════════════════════════════════════════════════════
   ADAPTADORES DB ↔ UI
═══════════════════════════════════════════════════════════════ */
const fmtBytes = bytes => {
  if (!bytes) return "—";
  return bytes > 1048576 ? (bytes/1048576).toFixed(1)+" MB" : (bytes/1024).toFixed(0)+" KB";
};

function dbToEmbarque(row) {
  return {
    id:             row.id,
    codigo:         row.codigo,
    fecha_salida:   row.fecha_salida,
    hora_salida:    row.hora_salida ? row.hora_salida.slice(0,5) : "00:00",
    status:         row.status,
    tracto_marca:   row.tracto_marca   || "",
    tracto_placa:   row.tracto_placa   || "",
    remolque_marca: row.remolque_marca || "",
    remolque_placa: row.remolque_placa || "",
    thermo:         row.thermo   || "",
    operador:       row.operador || "",
    caat:           row.caat     || "",
    alpha:          row.alpha    || "",
    sello:          row.sello_numero || "",
    notas:          row.notas    || "",
    destinos: (row.destinos||[]).sort((a,b)=>a.orden-b.orden).map(d=>({
      id:                d.id,
      orden:             d.orden,
      cliente:           d.cliente,
      cust_po:           d.cust_po           || "",
      warehouse:         d.warehouse_nombre  || "",
      direccion:         d.direccion         || "",
      telefono:          d.telefono          || "",
      tax_id:            d.tax_id            || "",
      fecha_entrega_est: d.fecha_entrega_est || "",
      fecha_entrega_real:d.fecha_entrega_real|| null,
    })),
    pallets: (row.pallets||[]).map(p=>({
      id:          p.id,
      tag:         p.tag_numero    || "",
      lote:        p.lote          || "",
      variedad:    p.variedad      || "",
      presentacion:p.presentacion  || "",
      label:       p.label         || "",
      calibre:     p.calibre       || "",
      fecha:       p.fecha_cosecha || "",
      cajas:       p.cajas         || 0,
      kg_neto:     parseFloat(p.kg_neto)  || 0,
      kg_bruto:    parseFloat(p.kg_bruto) || 0,
      temp_carga:  p.temp_carga != null ? parseFloat(p.temp_carga) : null,
    })),
    documentos: Object.fromEntries(
      (row.documentos||[]).map(d=>[d.tipo,{
        status: d.status,
        nombre: d.nombre_archivo || d.tipo,
        size:   fmtBytes(d.file_size_bytes),
        fecha:  d.uploaded_at ? d.uploaded_at.slice(0,10) : "",
        url:    d.storage_url  || null,
        path:   d.storage_path || null,
      }])
    ),
    correos: (row.correos||[]).map(c=>({
      id:           c.id,
      plantilla_id: c.plantilla_id || "",
      asunto:       c.asunto,
      body:         c.cuerpo_html,
      destinatarios:Array.isArray(c.destinatarios) ? c.destinatarios : [],
      adjuntos:     Array.isArray(c.adjuntos)      ? c.adjuntos      : [],
      enviado_at:   c.enviado_at ? c.enviado_at.slice(0,16).replace("T"," ") : "",
      enviado_por:  "Usuario",
      status:       c.status,
    })),
    tracking: (row.tracking||[])
      .map(t=>({
        id:     t.id,
        etapa:  t.etapa_nueva,
        fecha:  t.created_at ? t.created_at.slice(0,16).replace("T"," ") : "",
        usuario:"Usuario",
        temp:   t.temperatura != null ? parseFloat(t.temperatura) : null,
        notas:  t.notas || "",
      }))
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)),
  };
}

async function fetchEmbarqueCompleto(id) {
  const { data } = await supabase
    .from("embarques")
    .select(`*, destinos:embarque_destinos(*), pallets:embarque_pallets(*), documentos:embarque_documentos(*), correos:embarque_correos(*), tracking:embarque_tracking(*)`)
    .eq("id", id)
    .single();
  return data ? dbToEmbarque(data) : null;
}
const uid = () => Math.random().toString(36).slice(2,9);
const stageOf  = id => { const resolved = STAGE_ALIAS[id] || id; return STAGES.find(s=>s.id===resolved)||STAGES[0]; };
const nextStage= cur => { const resolved = STAGE_ALIAS[cur] || cur; const i=STAGES.findIndex(s=>s.id===resolved); return i<STAGES.length-1?STAGES[i+1].id:resolved; };
const fmt  = d => d?new Date(d+"T00:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtLong = d => d?new Date(d+"T00:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"—";
const totalPallets = e => e.pallets.length;
const totalCajas   = e => e.pallets.reduce((a,p)=>a+p.cajas,0);
const totalKg      = e => e.pallets.reduce((a,p)=>a+(p.kg_neto||0),0).toFixed(1);
const docsInfoEtapa= (e,etapa)=>{
  const resolved = STAGE_ALIAS[etapa] || etapa;
  const reqs=(DOCS_REQUERIDOS[resolved]||[]).filter(d=>d.req);
  const ok=reqs.filter(d=>e.documentos[d.key]?.status==="subido");
  return { total:reqs.length, ok:ok.length, faltantes:reqs.filter(d=>e.documentos[d.key]?.status!=="subido") };
};
const etapaSiguienteFaltantes=(e)=>{
  const resolved = STAGE_ALIAS[e.status] || e.status;
  const next=nextStage(e.status);
  if(next===resolved) return [];
  // docs de la etapa actual (usando alias resuelto) que se necesitan para avanzar
  return (DOCS_REQUERIDOS[resolved]||[]).filter(d=>d.req&&e.documentos[d.key]?.status!=="subido");
};

// Resolver variables en templates de correo
const resolveVars=(tmpl,e)=>{
  const vars={
    codigo:e.codigo,
    fecha_salida:fmt(e.fecha_salida),
    fecha_larga:fmtLong(e.fecha_salida),
    hora_salida:e.hora_salida,
    cajas_total:totalCajas(e),
    presentacion:e.pallets[0]?.presentacion||"—",
    cajas_por_pallet:e.pallets[0]?.cajas||"—",
    kg_total:totalKg(e),
    num_pallets:totalPallets(e),
    destinatario_nombre:e.destinos[0]?.cliente||"—",
    destinatario_direccion:e.destinos[0]?.direccion||"—",
    destinatario_telefono:e.destinos[0]?.telefono||"—",
    destinatario_tax_id:e.destinos[0]?.tax_id||"—",
    tracto_marca:e.tracto_marca,
    tracto_placa:e.tracto_placa,
    remolque_marca:e.remolque_marca,
    remolque_placa:e.remolque_placa,
    thermo:e.thermo,
    operador:e.operador,
    caat:e.caat,
    alpha:e.alpha,
  };
  return tmpl.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]??`{{${k}}}`);
};

/* ── Convierte texto plano de plantilla → HTML estilizado para email ── */
const bodyToHtml=(text,asunto)=>{
  const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // Procesar línea por línea
  const lines=text.split("\n");
  let html="";
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];
    const line=esc(raw);

    // Línea divisora ━━━ → <hr>
    if(/^━{5,}/.test(raw)){
      html+=`<hr style="border:none;border-top:1px solid #2a3f5a;margin:14px 0;">`;
      continue;
    }
    // Encabezados de sección en mayúsculas solos → título destacado
    if(/^[A-ZÁÉÍÓÚÑ\s]{4,}$/.test(raw.trim())&&raw.trim().length>3&&raw.trim().length<40){
      html+=`<div style="font-size:11px;font-weight:800;color:#7a97b8;letter-spacing:2px;text-transform:uppercase;margin:6px 0 4px;">${line}</div>`;
      continue;
    }
    // Línea con clave: valor → tabla de datos
    if(/^[A-Za-záéíóúñÁÉÍÓÚÑ\s\/]+:\s+.+/.test(raw)){
      const colonIdx=raw.indexOf(":");
      const key=esc(raw.slice(0,colonIdx));
      const val=esc(raw.slice(colonIdx+1).trim());
      html+=`<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #0d1e2e;">
        <span style="color:#4d6a85;font-size:12px;min-width:160px;font-weight:600;">${key}:</span>
        <span style="color:#dde6f0;font-size:12px;font-weight:700;">${val}</span>
      </div>`;
      continue;
    }
    // Línea vacía → espaciado
    if(raw.trim()===""){
      html+=`<div style="height:10px;"></div>`;
      continue;
    }
    // Línea normal
    html+=`<div style="color:#b0c4d8;font-size:13px;line-height:1.6;">${line}</div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060b12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060b12;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0c1825;border:1px solid #162035;border-radius:12px 12px 0 0;padding:20px 28px;border-bottom:2px solid #00c9a7;">
          <div style="font-size:11px;color:#7a97b8;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Agrícola Moray · Exportación</div>
          <div style="font-size:20px;font-weight:800;color:#dde6f0;">${esc(asunto)}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#09111c;border:1px solid #162035;border-top:none;padding:24px 28px;">
          ${html}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#060b12;border:1px solid #162035;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;text-align:center;">
          <div style="font-size:10px;color:#3d5470;">Este correo fue generado automáticamente por el sistema de exportación de Agrícola Moray.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/* ═══════════════════════════════════════════════════════════════
   ESTILOS
═══════════════════════════════════════════════════════════════ */
const S={
  btn:(color=T.teal)=>({ background:color+"18",border:`1px solid ${color}50`,color,borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:.3 }),
  btnPrimary:{ background:T.teal,border:"none",color:"#05120e",borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:800,cursor:"pointer",letterSpacing:.5 },
  btnDanger:{ background:T.red+"18",border:`1px solid ${T.red}50`,color:T.red,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer" },
  input:{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",color:T.txt1,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",colorScheme:"dark" },
  label:{ fontSize:11,fontWeight:700,color:T.txt3,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5 },
  textarea:{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.txt1,fontSize:12,outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical",fontFamily:T.mono,lineHeight:1.7,colorScheme:"dark" },
};

// CSS global para íconos calendario/reloj blancos
const GLOBAL_CSS=`
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator {
    filter: invert(1) brightness(2);
    cursor: pointer;
    opacity: 0.7;
  }
  input[type="date"], input[type="time"] { color-scheme: dark; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.85); }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   COMPONENTES ATOM
═══════════════════════════════════════════════════════════════ */
function Badge({text,color,dot}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,padding:"2px 8px",background:color+"18",border:`1px solid ${color}40`,borderRadius:20,color,letterSpacing:.3,whiteSpace:"nowrap"}}>
    {dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color,display:"inline-block"}}/>}{text}
  </span>;
}
function StageBadge({stageId}){const s=stageOf(stageId);return <Badge text={`${s.icon} ${s.name}`} color={s.color} dot/>;}
function Card({children,style={},onClick}){
  return <div onClick={onClick} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",cursor:onClick?"pointer":"default",...style}}
    onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor=T.borderLt;e.currentTarget.style.background=T.cardHov;}}}
    onMouseLeave={e=>{if(onClick){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.card;}}}
  >{children}</div>;
}
function Modal({children,onClose,title,width=720}){
  return <div style={{position:"fixed",inset:0,background:"#000b",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"32px 16px"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:T.surface,border:`1px solid ${T.borderLt}`,borderRadius:16,width:"100%",maxWidth:width,boxShadow:"0 30px 80px #000d"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:15,fontWeight:800,color:T.txt1}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.txt3,fontSize:20,cursor:"pointer",padding:"0 4px"}}>✕</button>
      </div>
      <div style={{padding:"20px"}}>{children}</div>
    </div>
  </div>;
}
function FormField({label,children}){return <div style={{marginBottom:12}}><label style={S.label}>{label}</label>{children}</div>;}
function Input({value,onChange,placeholder,type="text",style={}}){return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...S.input,...style}}/>;}
function Select({value,onChange,options,placeholder}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{...S.input,appearance:"none"}}>
    {placeholder&&<option value="">{placeholder}</option>}
    {options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}
  </select>;
}
function Divider({label}){return <div style={{display:"flex",alignItems:"center",gap:12,margin:"18px 0 12px"}}><div style={{flex:1,height:1,background:T.border}}/>{label&&<span style={{fontSize:10,fontWeight:800,color:T.txt2,textTransform:"uppercase",letterSpacing:1.5}}>{label}</span>}<div style={{flex:1,height:1,background:T.border}}/></div>;}
function ProgressBar({value,total,color}){const pct=total>0?(value/total)*100:0;return <div style={{flex:1,height:4,background:T.border,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct===100?T.green:color,borderRadius:4,transition:"width .3s"}}/></div>;}

/* ═══════════════════════════════════════════════════════════════
   GATE MODAL — bloqueo para avanzar de etapa
═══════════════════════════════════════════════════════════════ */
function GateModal({embarque,onConfirm,onCancel}){
  const faltantes=etapaSiguienteFaltantes(embarque);
  const next=stageOf(nextStage(embarque.status));
  const cur=stageOf(embarque.status);
  const canAdvance=faltantes.length===0;

  return <Modal title={canAdvance?"Confirmar Avance de Etapa":"Documentos Faltantes"} onClose={onCancel} width={500}>
    {canAdvance?(
      <div>
        <div style={{textAlign:"center",padding:"10px 0 20px"}}>
          <div style={{fontSize:40,marginBottom:10}}>✅</div>
          <div style={{fontSize:14,fontWeight:700,color:T.txt1,marginBottom:6}}>¡Documentos completos!</div>
          <div style={{fontSize:13,color:T.txt2}}>El embarque <span style={{color:cur.color,fontFamily:T.mono,fontWeight:700}}>{embarque.codigo}</span> está listo para avanzar de <span style={{color:cur.color,fontWeight:700}}>{cur.name}</span> a <span style={{color:next.color,fontWeight:700}}>{next.icon} {next.name}</span>.</div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",borderTop:`1px solid ${T.border}`,paddingTop:16}}>
          <button onClick={onCancel} style={S.btn(T.txt3)}>Cancelar</button>
          <button onClick={onConfirm} style={{...S.btnPrimary,background:next.color,color:"#04130c"}}>Avanzar a {next.name} {next.icon}</button>
        </div>
      </div>
    ):(
      <div>
        <div style={{background:T.red+"0a",border:`1px solid ${T.red}30`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.red,marginBottom:6}}>⚠️ Faltan {faltantes.length} documento{faltantes.length>1?"s":""} obligatorio{faltantes.length>1?"s":""}</div>
          <div style={{fontSize:12,color:T.txt2}}>Para avanzar a <span style={{color:next.color,fontWeight:700}}>{next.icon} {next.name}</span> necesitas subir:</div>
        </div>
        <div style={{display:"grid",gap:6,marginBottom:18}}>
          {faltantes.map(d=>(
            <div key={d.key} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`}}>
              <span style={{fontSize:16}}>{d.icon}</span>
              <span style={{fontSize:12,color:T.txt2}}>{d.label}</span>
              <Badge text="Pendiente" color={T.red}/>
            </div>
          ))}
        </div>
        <div style={{fontSize:12,color:T.txt3,marginBottom:16}}>Ve a la pestaña <span style={{color:T.amber}}>📋 Documentos</span> para subir los archivos faltantes.</div>
        <div style={{display:"flex",gap:10,justifyContent:"space-between",borderTop:`1px solid ${T.border}`,paddingTop:16}}>
          <button onClick={onConfirm} style={{...S.btn(T.amber),fontSize:11,border:`1px solid ${T.amber}40`}}>📤 Solicitar autorización al admin ↗</button>
          <button onClick={onCancel} style={S.btnPrimary}>Entendido — subir docs</button>
        </div>
      </div>
    )}
  </Modal>;
}

/* ═══════════════════════════════════════════════════════════════
   TAB DOCUMENTOS — Fase 2 completa
═══════════════════════════════════════════════════════════════ */
function DocFileRow({doc, info, embarqueId, onUpload, onDelete, onPreview}){
  const fileRef=useRef();
  const subido=info?.status==="subido";
  const [drag,   setDrag]   =useState(false);
  const [loading,setLoading]=useState(false);
  const [errMsg, setErrMsg] =useState(null);

  const handleFile=useCallback(async file=>{
    if(!file||!embarqueId)return;
    setLoading(true); setErrMsg(null);
    try{
      const path=`${embarqueId}/${doc.key}/${Date.now()}_${file.name}`;
      // 1 — upload to Storage
      const {error:upErr}=await supabase.storage.from("export-docs").upload(path,file,{upsert:true});
      if(upErr) throw upErr;
      // 2 — get signed URL (2h)
      const {data:urlData,error:urlErr}=await supabase.storage.from("export-docs").createSignedUrl(path,7200);
      if(urlErr) throw urlErr;
      // 3 — upsert metadata row
      const {error:dbErr}=await supabase.from("embarque_documentos").upsert({
        embarque_id:embarqueId, tipo:doc.key, status:"subido",
        nombre_archivo:file.name, storage_path:path, storage_url:urlData.signedUrl,
        file_size_bytes:file.size, uploaded_at:new Date().toISOString(),
      },{onConflict:"embarque_id,tipo"});
      if(dbErr) throw dbErr;
      // 4 — update UI
      onUpload(doc.key,{status:"subido",nombre:file.name,size:fmtBytes(file.size),fecha:new Date().toISOString().slice(0,10),url:urlData.signedUrl,path});
    }catch(e){
      console.error("Upload:",e);
      setErrMsg(e.message||"Error al subir");
    }finally{ setLoading(false); }
  },[doc.key,embarqueId,onUpload]);

  const handleDeleteFile=async()=>{
    if(info?.path){
      await supabase.storage.from("export-docs").remove([info.path]).catch(()=>{});
      await supabase.from("embarque_documentos").delete().match({embarque_id:embarqueId,tipo:doc.key}).catch(()=>{});
    }
    onDelete(doc.key);
  };

  return(
    <div
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
      style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:9,
        background:drag?T.teal+"0a":subido?T.green+"06":T.surface,
        border:`1px solid ${drag?T.teal:subido?T.green+"40":T.border}`,transition:"all .15s"}}
    >
      <input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
      <div style={{width:20,height:20,borderRadius:5,background:subido?T.green:"transparent",border:`2px solid ${subido?T.green:T.txt3}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",fontSize:11,color:"#fff"}} onClick={()=>subido?handleDeleteFile():fileRef.current.click()}>
        {loading?"⏳":subido?"✓":""}
      </div>
      <span style={{fontSize:15,flexShrink:0}}>{doc.icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:subido?T.txt1:T.txt2}}>{doc.label}</div>
        {subido
          ?<div style={{fontSize:10,color:T.txt3,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{info.nombre} · {info.size} · {info.fecha}</div>
          :<div style={{fontSize:10,color:errMsg?T.red:T.txt3,marginTop:1}}>{loading?"Subiendo archivo…":errMsg||"Arrastra un archivo aquí o haz clic en \"Subir\""}</div>
        }
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
        {!doc.req&&<Badge text="Opcional" color={T.txt3}/>}
        {loading?<span style={{fontSize:11,color:T.teal}}>Subiendo…</span>
        :subido?(
          <>
            <Badge text="✅ Subido" color={T.green}/>
            <button onClick={()=>onPreview(doc,info)} style={{...S.btn(T.blue),padding:"4px 10px",fontSize:10}}>👁 Ver</button>
            <button onClick={handleDeleteFile} style={{...S.btn(T.red),padding:"4px 8px",fontSize:10}}>✕</button>
          </>
        ):(
          <button onClick={()=>fileRef.current.click()} style={{...S.btn(T.teal),padding:"4px 12px",fontSize:10}}>📎 Subir</button>
        )}
      </div>
    </div>
  );
}

function TabDocumentos({embarque:e,onUpdate}){
  const [preview,setPreview]=useState(null);
  const etapasConDocs=["cooler","cruce","transito","entregado"];

  const handleUpload=useCallback((key,fileInfo)=>{
    onUpdate({...e,documentos:{...e.documentos,[key]:fileInfo}});
  },[e,onUpdate]);

  const handleDelete=useCallback(key=>{
    const nuevo={...e.documentos};
    delete nuevo[key];
    onUpdate({...e,documentos:nuevo});
  },[e,onUpdate]);

  // Abre el archivo real desde Storage (refresca signed URL si venció)
  const handlePreview=async(doc,info)=>{
    if(info?.path){
      const {data}=await supabase.storage.from("export-docs").createSignedUrl(info.path,7200);
      if(data?.signedUrl){ window.open(data.signedUrl,"_blank"); return; }
    }
    if(info?.url){ window.open(info.url,"_blank"); return; }
    setPreview({doc,info});
  };

  // Resumen global
  const totalReq=etapasConDocs.reduce((a,et)=>a+(DOCS_REQUERIDOS[et]||[]).filter(d=>d.req).length,0);
  const totalOk =etapasConDocs.reduce((a,et)=>a+(DOCS_REQUERIDOS[et]||[]).filter(d=>d.req&&e.documentos[d.key]?.status==="subido").length,0);

  return(
    <div>
      {/* Global progress */}
      <div style={{display:"flex",gap:12,alignItems:"center",background:T.surface,borderRadius:10,padding:"12px 16px",marginBottom:20,border:`1px solid ${T.border}`}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:T.txt1}}>Progreso General de Documentación</span>
            <span style={{fontSize:12,fontWeight:800,color:totalOk===totalReq?T.green:T.amber}}>{totalOk}/{totalReq} obligatorios</span>
          </div>
          <ProgressBar value={totalOk} total={totalReq} color={T.amber}/>
        </div>
        {totalOk===totalReq
          ?<Badge text="✅ Completo" color={T.green}/>
          :<Badge text={`${totalReq-totalOk} pendientes`} color={T.red}/>
        }
      </div>

      {etapasConDocs.map(etapaKey=>{
        const stage=stageOf(etapaKey);
        const docs=DOCS_REQUERIDOS[etapaKey]||[];
        const reqs=docs.filter(d=>d.req);
        const ok=reqs.filter(d=>e.documentos[d.key]?.status==="subido").length;

        return(
          <div key={etapaKey} style={{marginBottom:22}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:16}}>{stage.icon}</span>
              <span style={{fontSize:13,fontWeight:800,color:stage.color}}>{stage.name}</span>
              <ProgressBar value={ok} total={reqs.length} color={stage.color}/>
              <span style={{fontSize:11,fontWeight:700,color:ok===reqs.length?T.green:T.txt3,whiteSpace:"nowrap"}}>{ok}/{reqs.length}</span>
            </div>
            <div style={{display:"grid",gap:6}}>
              {docs.map(doc=>(
                <DocFileRow key={doc.key} doc={doc} info={e.documentos[doc.key]}
                  embarqueId={e.id}
                  onUpload={handleUpload} onDelete={handleDelete}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Preview modal */}
      {preview&&(
        <Modal title="Vista Previa de Documento" onClose={()=>setPreview(null)} width={480}>
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>
              {preview.info.nombre.endsWith(".xml")?"🗂":"📄"}
            </div>
            <div style={{fontSize:16,fontWeight:700,color:T.txt1,marginBottom:4}}>{preview.doc.label}</div>
            <div style={{fontSize:13,color:T.txt2,fontFamily:T.mono,marginBottom:16}}>{preview.info.nombre}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              {[
                {l:"Tamaño",v:preview.info.size,c:T.blue},
                {l:"Fecha",v:preview.info.fecha,c:T.teal},
                {l:"Estado",v:"Subido ✅",c:T.green},
              ].map(k=>(
                <div key={k.l} style={{background:k.c+"0c",border:`1px solid ${k.c}25`,borderRadius:8,padding:"8px 16px",minWidth:100}}>
                  <div style={{fontSize:9,color:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:k.c,marginTop:3}}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:20,padding:"10px 16px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,fontSize:12,color:T.txt3}}>
              La previsualización completa de PDFs y XMLs estará disponible al conectar con Supabase Storage.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB CORREOS — Fase 2 completa
═══════════════════════════════════════════════════════════════ */
function EmailComposer({embarque:e, contactos, onSend, onClose}){
  const [step,setStep]=useState("compose"); // compose | preview
  const [tmplId,setTmplId]=useState("");
  const [asunto,setAsunto]=useState("");
  const [body,setBody]=useState("");
  const [destSelected,setDestSelected]=useState({});
  const [adjuntos,setAdjuntos]=useState({});

  const tmpl=EMAIL_TEMPLATES.find(t=>t.id===tmplId);

  const cargarPlantilla=id=>{
    const t=EMAIL_TEMPLATES.find(x=>x.id===id);
    if(!t)return;
    setTmplId(id);
    setAsunto(resolveVars(t.asunto,e));
    setBody(resolveVars(t.body,e));
    // Pre-select recipients by role
    const sel={};
    contactos.forEach(c=>{
      if(c.es_fijo||t.roles.includes(c.rol)) sel[c.id]=true;
    });
    setDestSelected(sel);
    // Pre-select suggested attachments
    const adj={};
    t.adjuntos_sugeridos.forEach(k=>{
      if(e.documentos[k]?.status==="subido") adj[k]=true;
    });
    setAdjuntos(adj);
  };

  const toggleDest=id=>setDestSelected(s=>({...s,[id]:!s[id]}));
  const toggleAdj=key=>setAdjuntos(s=>({...s,[key]:!s[key]}));

  const selectedEmails=contactos.filter(c=>destSelected[c.id]).map(c=>c.email);
  const selectedAdjuntos=Object.keys(adjuntos).filter(k=>adjuntos[k]);
  const docsSubidos=ALL_DOCS_FLAT.filter(d=>e.documentos[d.key]?.status==="subido");

  const [sending,setSending]=useState(false);

  const enviar=async()=>{
    if(!selectedEmails.length){ alert("Selecciona al menos un destinatario"); return; }
    if(!asunto){ alert("El asunto es requerido"); return; }
    setSending(true);
    try{
      // Llamar al Edge Function que envía el correo por Gmail
      const { data:fnData, error:fnErr } = await supabase.functions.invoke("send-email",{
        body:{
          embarque_id:e.id,
          plantilla_id:tmplId||null,
          asunto,
          cuerpo_html:bodyToHtml(body,asunto),  // ← convertir a HTML estilizado
          destinatarios:selectedEmails,
          adjuntos:selectedAdjuntos,
        }
      });
      if(fnErr) throw new Error(fnErr.message);
      if(!fnData?.success) throw new Error(fnData?.error||"Error desconocido al enviar");

      onSend({
        id:fnData.correo_id||uid(), plantilla_id:tmplId, asunto, body,
        destinatarios:selectedEmails, adjuntos:selectedAdjuntos,
        enviado_at:new Date().toLocaleString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),
        enviado_por:fnData.remitente||"Sistema", status:"enviado",
      });
      onClose();
    }catch(err){
      alert("Error al enviar correo:\n"+(err.message||err));
    }finally{ setSending(false); }
  };

  return(
    <Modal title="Compositor de Correo" onClose={onClose} width={820}>
      {step==="compose"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {/* Left: compose */}
          <div>
            <FormField label="Plantilla">
              <Select value={tmplId} onChange={cargarPlantilla} placeholder="— Seleccionar plantilla —"
                options={EMAIL_TEMPLATES.map(t=>({value:t.id,label:t.nombre}))}
              />
            </FormField>

            <FormField label="Asunto">
              <Input value={asunto} onChange={setAsunto} placeholder="Asunto del correo"/>
            </FormField>

            <FormField label="Cuerpo del correo">
              <textarea value={body} onChange={e=>setBody(e.target.value)} rows={12} style={S.textarea} placeholder="Selecciona una plantilla para comenzar..."/>
            </FormField>
          </div>

          {/* Right: recipients + attachments */}
          <div>
            <FormField label={`Destinatarios (${selectedEmails.length} seleccionados)`}>
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",maxHeight:220,overflowY:"auto"}}>
                {contactos.map(c=>{
                  const sel=!!destSelected[c.id];
                  return(
                    <div key={c.id} onClick={()=>toggleDest(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",cursor:"pointer",background:sel?T.teal+"0a":"transparent",borderBottom:`1px solid ${T.border}30`,transition:"background .1s"}}>
                      <div style={{width:16,height:16,borderRadius:4,background:sel?T.teal:"transparent",border:`2px solid ${sel?T.teal:T.txt3}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",flexShrink:0}}>{sel?"✓":""}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:12,fontWeight:600,color:T.txt1}}>{c.nombre}</span>
                          {c.es_fijo&&<Badge text="Fijo" color={T.teal}/>}
                        </div>
                        <div style={{fontSize:10,color:T.txt3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.email}</div>
                      </div>
                      <Badge text={ROL_LABELS[c.rol]||c.rol} color={ROL_COLORS[c.rol]||T.txt2}/>
                    </div>
                  );
                })}
              </div>
            </FormField>

            <FormField label={`Adjuntos (${selectedAdjuntos.length} seleccionados)`}>
              {docsSubidos.length===0
                ?<div style={{padding:"12px",background:T.surface,borderRadius:8,fontSize:12,color:T.txt3,border:`1px solid ${T.border}`}}>No hay documentos subidos aún</div>
                :<div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",maxHeight:200,overflowY:"auto"}}>
                  {docsSubidos.map(d=>{
                    const sel=!!adjuntos[d.key];
                    const info=e.documentos[d.key];
                    return(
                      <div key={d.key} onClick={()=>toggleAdj(d.key)} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",cursor:"pointer",background:sel?T.blue+"0a":"transparent",borderBottom:`1px solid ${T.border}30`,transition:"background .1s"}}>
                        <div style={{width:16,height:16,borderRadius:4,background:sel?T.blue:"transparent",border:`2px solid ${sel?T.blue:T.txt3}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",flexShrink:0}}>{sel?"✓":""}</div>
                        <span style={{fontSize:13}}>{d.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:500,color:T.txt1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{info.nombre}</div>
                          <div style={{fontSize:9,color:T.txt3}}>{info.size}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </FormField>
          </div>
        </div>
      )}

      {step==="preview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:20}}>
          {/* Email preview */}
          <div>
            <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface}}>
                <div style={{fontSize:11,color:T.txt3,marginBottom:2}}>Para: <span style={{color:T.txt2}}>{selectedEmails.join(", ")||"(sin destinatarios)"}</span></div>
                <div style={{fontSize:13,fontWeight:700,color:T.txt1}}>Asunto: {asunto}</div>
                {selectedAdjuntos.length>0&&<div style={{fontSize:10,color:T.txt3,marginTop:4}}>📎 {selectedAdjuntos.length} adjunto{selectedAdjuntos.length>1?"s":""}: {selectedAdjuntos.map(k=>e.documentos[k]?.nombre).join(", ")}</div>}
              </div>
              <pre style={{padding:"16px",fontSize:12,color:T.txt2,whiteSpace:"pre-wrap",margin:0,fontFamily:T.mono,lineHeight:1.8,maxHeight:380,overflowY:"auto"}}>{body}</pre>
            </div>
          </div>
          {/* Summary */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:T.surface,borderRadius:10,padding:14,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:T.txt3,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Resumen</div>
              {[
                {l:"Plantilla",v:tmpl?.nombre||"—"},
                {l:"Destinatarios",v:selectedEmails.length},
                {l:"Adjuntos",v:selectedAdjuntos.length},
              ].map(k=>(
                <div key={k.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${T.border}30`}}>
                  <span style={{fontSize:11,color:T.txt3}}>{k.l}</span>
                  <span style={{fontSize:12,fontWeight:700,color:T.txt1}}>{k.v}</span>
                </div>
              ))}
            </div>
            {selectedEmails.length===0&&<div style={{background:T.red+"0a",border:`1px solid ${T.red}30`,borderRadius:8,padding:"10px 12px",fontSize:11,color:T.red}}>⚠️ No hay destinatarios seleccionados.</div>}
            {selectedEmails.length>0&&<div style={{background:T.green+"0a",border:`1px solid ${T.green}30`,borderRadius:8,padding:"10px 12px",fontSize:11,color:T.green}}>✅ Listo para enviar</div>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
        <button onClick={step==="compose"?onClose:()=>setStep("compose")} style={S.btn(T.txt3)}>
          {step==="compose"?"Cancelar":"← Editar"}
        </button>
        <div style={{display:"flex",gap:10}}>
          {step==="compose"&&<button onClick={()=>setStep("preview")} disabled={!tmplId||!body} style={{...S.btnPrimary,opacity:(!tmplId||!body)?0.4:1}}>Vista Previa →</button>}
          {step==="preview"&&<button onClick={enviar} disabled={selectedEmails.length===0||sending} style={{...S.btnPrimary,background:T.green,color:"#03110a",opacity:(selectedEmails.length===0||sending)?0.4:1}}>{sending?"Guardando…":"✉️ Registrar Correo"}</button>}
        </div>
      </div>
    </Modal>
  );
}

function EmailHistoryItem({correo}){
  const [open,setOpen]=useState(false);
  const tmpl=EMAIL_TEMPLATES.find(t=>t.id===correo.plantilla_id);
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",marginBottom:8}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:T.surface,cursor:"pointer"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,color:T.txt1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{correo.asunto}</div>
          <div style={{fontSize:10,color:T.txt3,marginTop:2}}>{correo.enviado_at} · por {correo.enviado_por} · {correo.destinatarios.length} destinatario{correo.destinatarios.length!==1?"s":""}</div>
        </div>
        <Badge text={tmpl?.nombre?.split(" ").slice(1,3).join(" ")||"Correo"} color={T.blue}/>
        {correo.adjuntos?.length>0&&<Badge text={`📎 ${correo.adjuntos.length}`} color={T.purple}/>}
        <Badge text="✅ Enviado" color={T.green}/>
        <span style={{color:T.txt3,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{padding:"14px",background:T.bg,borderTop:`1px solid ${T.border}`}}>
          <div style={{fontSize:10,color:T.txt3,marginBottom:6}}>Para: <span style={{color:T.txt2}}>{correo.destinatarios.join(", ")}</span></div>
          {correo.adjuntos?.length>0&&<div style={{fontSize:10,color:T.txt3,marginBottom:10}}>Adjuntos: <span style={{color:T.purple}}>{correo.adjuntos.join(", ")}</span></div>}
          <pre style={{fontSize:11,color:T.txt2,whiteSpace:"pre-wrap",margin:0,fontFamily:T.mono,lineHeight:1.7,maxHeight:220,overflowY:"auto"}}>{correo.body}</pre>
        </div>
      )}
    </div>
  );
}

function TabCorreos({embarque:e,onUpdate,contactos}){
  const [composerOpen,setComposerOpen]=useState(false);

  const enviarCorreo=correo=>{
    onUpdate({...e,correos:[...e.correos,correo]});
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:T.txt1}}>Correos del Embarque</div>
          <div style={{fontSize:11,color:T.txt3,marginTop:2}}>{e.correos.length} correo{e.correos.length!==1?"s":""} enviado{e.correos.length!==1?"s":""}</div>
        </div>
        <button onClick={()=>setComposerOpen(true)} style={S.btnPrimary}>✉️ Nuevo Correo</button>
      </div>

      {/* Template quick-access */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
        {EMAIL_TEMPLATES.map(t=>(
          <button key={t.id} onClick={()=>setComposerOpen(true)} style={{...S.btn(T.blue),fontSize:11,padding:"5px 12px"}}>
            {t.nombre.split(" ")[0]} {t.nombre.split(" ").slice(1,3).join(" ")}
          </button>
        ))}
      </div>

      {e.correos.length===0
        ?<div style={{textAlign:"center",padding:"40px 20px",border:`1px dashed ${T.border}`,borderRadius:12,color:T.txt3,fontSize:13}}>
            <div style={{fontSize:32,marginBottom:8}}>📬</div>
            Sin correos enviados aún.<br/>Usa el botón "Nuevo Correo" para enviar el aviso de salida.
          </div>
        :<div>{e.correos.slice().reverse().map(c=><EmailHistoryItem key={c.id} correo={c}/>)}</div>
      }

      {composerOpen&&<EmailComposer embarque={e} contactos={contactos} onSend={enviarCorreo} onClose={()=>setComposerOpen(false)}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB PALLETS (Fase 1 sin cambios)
═══════════════════════════════════════════════════════════════ */
function TabPallets({embarque:e,onUpdate,onEditEmbarque}){
  const [addOpen,setAddOpen]=useState(false);
  const [saving, setSaving] =useState(false);
  const [newP,setNewP]=useState({tag:"",lote:"",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"",cajas:144,kg_neto:"",kg_bruto:"",temp_carga:"",variedad:"Biloxi"});

  const calcKg=(pres,cajas)=>{ const f=KG_POR_CAJA[pres]; return f?(Number(cajas)*f).toFixed(1):""; };

  const agregarPallet=async()=>{
    if(!newP.tag||!newP.lote)return;
    setSaving(true);
    const kgNeto=calcKg(newP.presentacion,newP.cajas);
    try{
      const {data,error}=await supabase.from("embarque_pallets").insert({
        embarque_id:e.id, tag_numero:newP.tag, lote:newP.lote, variedad:newP.variedad,
        presentacion:newP.presentacion, label:newP.label, calibre:newP.calibre,
        fecha_cosecha:newP.fecha||null, cajas:Number(newP.cajas),
        kg_neto:Number(kgNeto)||null, kg_bruto:Number(newP.kg_bruto)||null,
        temp_carga:Number(newP.temp_carga)||null,
      }).select().single();
      if(error) throw error;
      const p={id:data.id,tag:data.tag_numero,lote:data.lote,variedad:data.variedad||"",presentacion:data.presentacion||"",label:data.label||"",calibre:data.calibre||"",fecha:data.fecha_cosecha||"",cajas:data.cajas,kg_neto:parseFloat(data.kg_neto)||0,kg_bruto:parseFloat(data.kg_bruto)||0,temp_carga:data.temp_carga!=null?parseFloat(data.temp_carga):null};
      onUpdate({...e,pallets:[...e.pallets,p]});
      setNewP(p=>({...p,tag:"",kg_bruto:"",temp_carga:""}));
      setAddOpen(false);
    }catch(err){ alert("Error al guardar pallet: "+err.message); }
    finally{ setSaving(false); }
  };

  const eliminar=async id=>{
    if(!window.confirm("¿Eliminar este pallet?"))return;
    try{
      await supabase.from("embarque_pallets").delete().eq("id",id);
      onUpdate({...e,pallets:e.pallets.filter(p=>p.id!==id)});
    }catch(err){ alert("Error: "+err.message); }
  };
  const totC=totalCajas(e), totK=totalKg(e);
  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {[{l:"Pallets",v:e.pallets.length,c:T.teal},{l:"Cajas",v:totC,c:T.green},{l:"KG Neto",v:totK,c:T.amber}].map(k=>(
          <div key={k.l} style={{flex:1,minWidth:90,background:k.c+"0c",border:`1px solid ${k.c}25`,borderRadius:10,padding:"8px 14px"}}>
            <div style={{fontSize:10,color:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
            <div style={{fontSize:20,fontWeight:900,color:k.c}}>{k.v}</div>
          </div>
        ))}
        <button onClick={()=>onEditEmbarque&&onEditEmbarque()} style={{...S.btnPrimary,alignSelf:"stretch",padding:"0 20px"}}>✏️ Editar Embarque</button>
      </div>
      <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${T.border}`}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:T.surface}}>
            {["N° TAG","Lote","Presentación","Label","Calibre","Fecha","Cajas","KG Neto","°C",""].map(h=>(
              <th key={h} style={{padding:"9px 12px",textAlign:"left",color:T.txt3,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap",borderBottom:`1px solid ${T.border}`}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {e.pallets.map((p,i)=>(
              <tr key={p.id} style={{borderBottom:`1px solid ${T.border}30`,background:i%2===1?T.surface+"60":"transparent"}}>
                <td style={{padding:"8px 12px",fontFamily:T.mono,fontWeight:700,color:T.teal}}>{p.tag}</td>
                <td style={{padding:"8px 12px",fontFamily:T.mono,color:T.purple}}>{p.lote}</td>
                <td style={{padding:"8px 12px",color:T.txt1}}>{p.presentacion}</td>
                <td style={{padding:"8px 12px",color:T.txt2}}>{p.label}</td>
                <td style={{padding:"8px 12px"}}><Badge text={p.calibre} color={T.green}/></td>
                <td style={{padding:"8px 12px",color:T.txt2,whiteSpace:"nowrap"}}>{fmt(p.fecha)}</td>
                <td style={{padding:"8px 12px",color:T.txt1,textAlign:"right"}}>{p.cajas}</td>
                <td style={{padding:"8px 12px",color:T.amber,textAlign:"right"}}>{p.kg_neto}</td>
                <td style={{padding:"8px 12px",color:p.temp_carga>4?T.red:p.temp_carga>2?T.amber:T.blue,textAlign:"right"}}>{p.temp_carga??"-"}</td>
                <td style={{padding:"8px 12px"}}><button onClick={()=>eliminar(p.id)} style={{background:"none",border:"none",color:T.txt3,cursor:"pointer",fontSize:14}}>🗑</button></td>
              </tr>
            ))}
            <tr style={{background:T.surface,borderTop:`2px solid ${T.borderLt}`}}>
              <td colSpan={6} style={{padding:"8px 12px",fontWeight:700,color:T.txt3,fontSize:11}}>TOTAL</td>
              <td style={{padding:"8px 12px",fontWeight:800,color:T.green,textAlign:"right"}}>{totC}</td>
              <td style={{padding:"8px 12px",fontWeight:800,color:T.amber,textAlign:"right"}}>{totK}</td>
              <td colSpan={2}/>
            </tr>
          </tbody>
        </table>
      </div>
      {addOpen&&(
        <Modal title="Agregar Pallet" onClose={()=>setAddOpen(false)} width={640}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="N° TAG *"><Input value={newP.tag} onChange={v=>setNewP({...newP,tag:v})} placeholder="ej: 2363298"/></FormField>
            <FormField label="Lote *"><Input value={newP.lote} onChange={v=>setNewP({...newP,lote:v})} placeholder="ej: AM26004RB"/></FormField>
            <FormField label="Presentación">
              <Select value={newP.presentacion} onChange={v=>setNewP({...newP,presentacion:v,kg_neto:calcKg(v,newP.cajas)})} options={PRESENTACIONES}/>
            </FormField>
            <FormField label="Label"><Select value={newP.label} onChange={v=>setNewP({...newP,label:v})} options={LABELS}/></FormField>
            <FormField label="Calibre"><Select value={newP.calibre} onChange={v=>setNewP({...newP,calibre:v})} options={CALIBRES}/></FormField>
            <FormField label="Variedad"><Select value={newP.variedad} onChange={v=>setNewP({...newP,variedad:v})} options={VARIEDADES}/></FormField>
            <FormField label="Fecha Cosecha"><Input type="date" value={newP.fecha} onChange={v=>setNewP({...newP,fecha:v})}/></FormField>
            <FormField label="Cajas/Pallet">
              <Input type="number" value={newP.cajas} onChange={v=>setNewP({...newP,cajas:v,kg_neto:calcKg(newP.presentacion,v)})}/>
            </FormField>
            <FormField label="KG Neto (auto)">
              <div style={{...S.input,background:T.bg,color:T.amber,fontWeight:700,cursor:"default",display:"flex",alignItems:"center"}}>
                {calcKg(newP.presentacion,newP.cajas)||"—"}
              </div>
            </FormField>
            <FormField label="KG Bruto"><Input type="number" value={newP.kg_bruto} onChange={v=>setNewP({...newP,kg_bruto:v})}/></FormField>
            <FormField label="Temp. Carga (°C)"><Input type="number" value={newP.temp_carga} onChange={v=>setNewP({...newP,temp_carga:v})} placeholder="1.2"/></FormField>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}>
            <button onClick={()=>setAddOpen(false)} style={S.btn(T.txt3)}>Cancelar</button>
            <button onClick={agregarPallet} disabled={saving} style={{...S.btnPrimary,opacity:saving?0.5:1}}>{saving?"Guardando…":"Agregar Pallet"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── TAB TRACKING ─────────────────────────────────────────── */
function TabTracking({embarque:e}){
  return(
    <div style={{maxWidth:560}}>
      {e.tracking.map((t,i)=>{
        const st=stageOf(t.etapa); const isLast=i===e.tracking.length-1;
        return(
          <div key={t.id} style={{display:"flex",gap:16,position:"relative"}}>
            {!isLast&&<div style={{position:"absolute",left:16,top:36,bottom:0,width:2,background:T.border}}/>}
            <div style={{width:34,height:34,borderRadius:"50%",background:isLast?st.color+"25":T.surface,border:`2px solid ${st.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,zIndex:1}}>{st.icon}</div>
            <div style={{paddingBottom:20,flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700,color:st.color}}>{st.name}</span>
                <span style={{fontSize:10,color:T.txt3}}>{t.fecha}</span>
                {t.temp!=null&&<Badge text={`${t.temp}°C`} color={t.temp>4?T.red:t.temp>2?T.amber:T.blue}/>}
              </div>
              <div style={{fontSize:12,color:T.txt2,marginTop:4,lineHeight:1.6}}>{t.notas}</div>
              <div style={{fontSize:10,color:T.txt3,marginTop:3}}>por {t.usuario}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETALLE DE EMBARQUE
═══════════════════════════════════════════════════════════════ */
function DetalleEmbarque({embarque:e,onBack,onUpdate,contactos,onRequestApproval,catalogoDestinos}){
  const [tab,setTab]=useState("pallets");
  const [gateOpen,setGateOpen]=useState(false);
  const [advancing,setAdvancing]=useState(false);
  const [editWizardOpen,setEditWizardOpen]=useState(false);
  const stage=stageOf(e.status);
  const next=nextStage(e.status);

  const confirmarAvance=async()=>{
    setAdvancing(true);
    try{
      const {error}=await supabase.from("embarques")
        .update({status:next,updated_at:new Date().toISOString()})
        .eq("id",e.id);
      if(error) throw error;
      const {data:tRow}=await supabase.from("embarque_tracking")
        .insert({embarque_id:e.id,etapa_anterior:e.status,etapa_nueva:next,notas:`Avanzado a ${stageOf(next).name}`})
        .select().single();
      const newTrack={id:tRow?.id||uid(),etapa:next,fecha:new Date().toLocaleString("es-MX"),usuario:"Usuario",temp:null,notas:`Avanzado a ${stageOf(next).name}`};
      onUpdate({...e,status:next,tracking:[...e.tracking,newTrack]});
      setGateOpen(false);
    }catch(err){ alert("Error al avanzar: "+err.message); }
    finally{ setAdvancing(false); }
  };

  // ── Fase 8: interceptar avance con documentos faltantes ──────────────────
  const handleGateConfirmWithApproval=()=>{
    const faltantes=etapaSiguienteFaltantes(e);
    if(faltantes.length===0){
      // Sin faltantes → avanzar directo
      confirmarAvance();
      return;
    }
    // Con faltantes → solicitar autorización
    if(onRequestApproval){
      setGateOpen(false);
      onRequestApproval({
        action_key:   "exportacion.kanban.advance_without_docs",
        context_id:   e.id,
        context_data: {
          embarque:        e.codigo,
          destino:         e.destinos[0]?.cliente ?? "—",
          etapa_destino:   stageOf(next).name,
          next_status:     next,          // ID real de la etapa — usado por auto-execute
          docs_faltantes:  faltantes.map(d=>d.label).join(", "),
        },
        title:       "Avanzar sin documentos completos",
        description: `El embarque ${e.codigo} tiene ${faltantes.length} documento${faltantes.length>1?"s":""} obligatorio${faltantes.length>1?"s":""} pendiente${faltantes.length>1?"s":""}. Para avanzar a ${stageOf(next).name} sin ellos necesitas autorización del administrador.`,
        onApproved:  ()=>confirmarAvance(),
      });
    } else {
      // Fallback si no hay handler (admin ve siempre el botón)
      confirmarAvance();
    }
  };

  // Calcular faltantes de docs en etapa actual para badge
  const docInfo=(() => {
    const reqs=(DOCS_REQUERIDOS[e.status]||[]).filter(d=>d.req);
    const ok=reqs.filter(d=>e.documentos[d.key]?.status==="subido").length;
    return {total:reqs.length,ok};
  })();

  const TABS=[
    {id:"pallets",   label:"📦 Pallets"},
    {id:"documentos",label:"📋 Documentos",badge:docInfo.total>0&&docInfo.ok<docInfo.total?`${docInfo.total-docInfo.ok} ⚠️`:null},
    {id:"tracking",  label:"📍 Tracking"},
    {id:"correos",   label:"✉️ Correos",badge:e.correos.length>0?e.correos.length:null},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:T.txt3,cursor:"pointer",fontSize:20,padding:0}}>←</button>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontFamily:T.mono,fontSize:20,fontWeight:900,color:stage.color}}>{e.codigo}</span>
              <StageBadge stageId={e.status}/>
            </div>
            <div style={{fontSize:12,color:T.txt3,marginTop:2}}>{e.destinos[0]?.cliente} · {fmt(e.fecha_salida)} · {e.hora_salida} hs</div>
          </div>
          {e.status!=="entregado"&&(
            <button onClick={()=>setGateOpen(true)} disabled={advancing} style={{...S.btnPrimary,marginLeft:"auto",opacity:advancing?0.5:1}}>
              {advancing?"Guardando…":`Avanzar a ${stageOf(next).name} ${stageOf(next).icon}`}
            </button>
          )}
        </div>
        {/* KPIs */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[{l:"Pallets",v:totalPallets(e),c:T.teal},{l:"Cajas",v:totalCajas(e),c:T.amber},{l:"KG",v:totalKg(e),c:T.blue},{l:"Destinos",v:e.destinos.length,c:T.purple},{l:"Placa",v:e.tracto_placa,c:T.txt2},{l:"Op.",v:e.operador,c:T.txt2}].map(k=>(
            <div key={k.l} style={{background:k.c+"10",border:`1px solid ${k.c}25`,borderRadius:8,padding:"5px 12px"}}>
              <div style={{fontSize:9,color:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
              <div style={{fontSize:13,fontWeight:700,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:tab===t.id?`2px solid ${T.teal}`:"2px solid transparent",color:tab===t.id?T.teal:T.txt3,padding:"10px 16px",fontSize:12,fontWeight:700,cursor:"pointer",marginBottom:-1,display:"flex",alignItems:"center",gap:6}}>
            {t.label}
            {t.badge&&<span style={{fontSize:9,background:T.red+"30",color:T.red,border:`1px solid ${T.red}40`,borderRadius:10,padding:"1px 5px",fontWeight:700}}>{t.badge}</span>}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
        {tab==="pallets"    &&<TabPallets    embarque={e} onUpdate={onUpdate} onEditEmbarque={()=>setEditWizardOpen(true)}/>}
        {tab==="documentos" &&<TabDocumentos embarque={e} onUpdate={onUpdate}/>}
        {tab==="tracking"   &&<TabTracking   embarque={e}/>}
        {tab==="correos"    &&<TabCorreos    embarque={e} onUpdate={onUpdate} contactos={contactos}/>}
      </div>
      {gateOpen&&<GateModal embarque={e} onConfirm={handleGateConfirmWithApproval} onCancel={()=>setGateOpen(false)}/>}
      {editWizardOpen&&<WizardEditarEmbarque embarque={e} onClose={()=>setEditWizardOpen(false)} onSaved={updated=>{onUpdate(updated);setEditWizardOpen(false);}} onRequestApproval={onRequestApproval} catalogoDestinos={catalogoDestinos||[]}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KANBAN VIEW — Cooler+Documentación combinados en una columna
═══════════════════════════════════════════════════════════════ */
// Columnas del pipeline visual (Cooler y Documentación son una sola)
const PIPELINE_COLS = [
  { id:"prep",     ids:["cooler","documentacion"], name:"Cooler / Docs",   icon:"❄️📋", color:T.teal   },
  { id:"cruce",    ids:["cruce"],                  name:"Cruce Frontera",  icon:"🛃",   color:T.orange },
  { id:"transito", ids:["transito"],               name:"Tránsito US",     icon:"🚛",   color:T.blue   },
  { id:"entregado",ids:["entregado"],              name:"Entregado",        icon:"✅",   color:T.green  },
];

function KanbanView({embarques,onSelect,onNuevo,onRefresh,refreshing}){
  // Agrupa embarques por columna visual
  const byCol={};
  PIPELINE_COLS.forEach(c=>{byCol[c.id]=[];});
  embarques.forEach(e=>{
    const col=PIPELINE_COLS.find(c=>c.ids.includes(e.status));
    if(col) byCol[col.id].push(e);
  });

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:T.txt1}}>Pipeline de Embarques</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:2}}>
            <span style={{fontSize:12,color:T.txt3}}>{embarques.length} embarques activos</span>
            <span style={{fontSize:10,color:T.txt3,background:T.teal+"15",border:`1px solid ${T.teal}30`,borderRadius:20,padding:"1px 8px",display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:T.teal,display:"inline-block",animation:"pulse 2s ease-in-out infinite"}}/>
              Sincronizado en tiempo real
            </span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Recargar todos los embarques desde la base de datos"
            style={{
              padding:"8px 14px",borderRadius:8,cursor:refreshing?"not-allowed":"pointer",
              background:"transparent",border:`1px solid ${T.border}`,
              color:refreshing?T.txt3:T.txt2,fontSize:12,fontWeight:600,
              display:"flex",alignItems:"center",gap:6,transition:"all .15s",
              opacity:refreshing?0.6:1,
            }}
            onMouseEnter={el=>{if(!refreshing){el.currentTarget.style.borderColor=T.teal;el.currentTarget.style.color=T.teal;}}}
            onMouseLeave={el=>{el.currentTarget.style.borderColor=T.border;el.currentTarget.style.color=T.txt2;}}
          >
            <span style={{display:"inline-block",animation:refreshing?"spin .7s linear infinite":"none"}}>🔄</span>
            {refreshing?"Actualizando…":"Actualizar"}
          </button>
          <button style={S.btnPrimary} onClick={onNuevo}>+ Nuevo Embarque</button>
        </div>
      </div>
      {/* KPI strip */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {PIPELINE_COLS.map(col=>{const c=byCol[col.id].length;return(
          <div key={col.id} style={{flex:1,padding:"10px 14px",borderRight:`1px solid ${T.border}`,textAlign:"center"}}>
            <div style={{fontSize:10,color:col.color,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{col.icon} {col.name}</div>
            <div style={{fontSize:22,fontWeight:900,color:c>0?col.color:T.txt3,marginTop:2}}>{c}</div>
          </div>
        );})}
      </div>
      <div style={{flex:1,overflowX:"auto",display:"flex",gap:0}}>
        {PIPELINE_COLS.map(col=>(
          <div key={col.id} style={{minWidth:280,width:"25%",borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column"}}>
            <div style={{padding:"10px 14px",background:col.color+"08",borderBottom:`2px solid ${col.color}40`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <span style={{fontSize:14}}>{col.icon}</span>
              <span style={{fontSize:12,fontWeight:800,color:col.color,textTransform:"uppercase",letterSpacing:.5}}>{col.name}</span>
              <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:col.color,background:col.color+"20",borderRadius:20,padding:"1px 8px"}}>{byCol[col.id].length}</span>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"10px 8px",display:"flex",flexDirection:"column",gap:8}}>
              {byCol[col.id].map(e=>{
                const faltantes=etapaSiguienteFaltantes(e).length;
                const stage=stageOf(e.status);
                return(
                  <div key={e.id} onClick={()=>onSelect(e)} style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`3px solid ${stage.color}`,borderRadius:"0 10px 10px 0",padding:"10px 12px",cursor:"pointer",transition:"all .12s"}}
                    onMouseEnter={el=>{el.currentTarget.style.background=T.cardHov;}}
                    onMouseLeave={el=>{el.currentTarget.style.background=T.card;}}
                  >
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,color:stage.color}}>{e.codigo}</span>
                        <span style={{marginLeft:6,fontSize:9,background:stage.color+"18",color:stage.color,border:`1px solid ${stage.color}40`,borderRadius:4,padding:"1px 5px"}}>{stage.icon} {stage.name}</span>
                      </div>
                      {faltantes>0&&<span style={{fontSize:9,background:T.amber+"20",color:T.amber,border:`1px solid ${T.amber}40`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>⚠️ {faltantes}</span>}
                    </div>
                    <div style={{fontSize:11,color:T.txt2,marginTop:4}}>{e.destinos[0]?.cliente?.split(" ").slice(0,3).join(" ")||"—"}</div>
                    <div style={{fontSize:10,color:T.txt3,marginTop:1}}>{e.destinos[0]?.warehouse?.split(" ").slice(0,3).join(" ")}</div>
                    <div style={{display:"flex",gap:10,marginTop:8}}>
                      <span style={{fontSize:10,color:T.txt3}}>🏷️ <b style={{color:T.txt2}}>{totalPallets(e)}</b> pallets</span>
                      <span style={{fontSize:10,color:T.txt3}}>📦 <b style={{color:T.txt2}}>{totalCajas(e)}</b></span>
                    </div>
                    <div style={{fontSize:10,color:T.txt3,marginTop:4}}>📅 {fmt(e.fecha_salida)}</div>
                  </div>
                );
              })}
              {byCol[col.id].length===0&&<div style={{textAlign:"center",padding:"24px 12px",color:T.txt3,fontSize:11,border:`1px dashed ${T.border}`,borderRadius:10,marginTop:4}}>Sin embarques</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WIZARD NUEVO EMBARQUE
═══════════════════════════════════════════════════════════════ */
const BLANK_E={codigo:"",fecha_salida:"",hora_salida:"00:30",tracto_marca:"",tracto_placa:"",remolque_marca:"",remolque_placa:"",thermo:"",operador:"",caat:"",alpha:"",sello:"",notas:""};
const BLANK_D={id:"",orden:1,cliente:"",warehouse:"",direccion:"",telefono:"",tax_id:"",fecha_entrega_est:"",fecha_entrega_real:null};
const BLANK_P={tag:"",lote:"",presentacion:"8X18",label:"RIVER RUN",calibre:"LARGE",fecha:"",cajas:144,kg_neto:"",kg_bruto:"",temp_carga:"",variedad:"Biloxi"};

function WizardNuevoEmbarque({onClose,onCreate,catalogoDestinos}){
  const [step,setStep]=useState(1);
  const [data,setData]=useState({...BLANK_E,id:uid()});
  const [dests,setDests]=useState([{...BLANK_D,id:uid(),orden:1}]);
  const [pallets,setPallets]=useState([]);
  const [newP,setNewP]=useState({...BLANK_P,id:uid()});

  const setF=(k,v)=>setData(d=>({...d,[k]:v}));
  const setDest=(i,k,v)=>{const ds=[...dests];ds[i]={...ds[i],[k]:v};setDests(ds);};
  const autoFill=(i,catId)=>{
    const c=catalogoDestinos.find(x=>x.id===catId);
    if(!c)return;
    const ds=[...dests];
    ds[i]={...ds[i],
      cliente:c.nombre,
      warehouse:c.nombre,
      direccion:`${c.direccion||""}, ${c.ciudad||""}, ${c.estado||""} ${c.cp||""}`.replace(/^,\s*/,"").trim(),
      telefono:c.telefono||"",
      tax_id:c.tax_id||"",
    };
    setDests(ds);
  };
  const calcKgNeto=(presentacion,cajas)=>{
    const factor=KG_POR_CAJA[presentacion];
    return factor?(Number(cajas)*factor).toFixed(1):"";
  };
  const addPallet=()=>{
    if(!newP.tag)return;
    const kg=calcKgNeto(newP.presentacion,newP.cajas);
    setPallets(ps=>[...ps,{...newP,id:uid(),cajas:Number(newP.cajas),kg_neto:Number(kg)||0,kg_bruto:Number(newP.kg_bruto)||0,temp_carga:Number(newP.temp_carga)||null}]);
    setNewP(p=>({...p,id:uid(),tag:"",kg_bruto:"",temp_carga:""}));
  };
  const [saving,setSaving]=useState(false);
  const crear=async()=>{
    if(!data.codigo||!data.fecha_salida){alert("Código y fecha son requeridos");return;}
    setSaving(true);
    try{
      // 1 — embarque principal
      const {data:emb,error:embErr}=await supabase.from("embarques").insert({
        codigo:data.codigo, fecha_salida:data.fecha_salida, hora_salida:data.hora_salida||null,
        status:"cooler", tracto_marca:data.tracto_marca, tracto_placa:data.tracto_placa,
        remolque_marca:data.remolque_marca, remolque_placa:data.remolque_placa,
        thermo:data.thermo, operador:data.operador, caat:data.caat, alpha:data.alpha,
        sello_numero:data.sello, notas:data.notas,
      }).select().single();
      if(embErr) throw embErr;
      // 2 — destinos
      if(dests.length>0){
        const {error:dErr}=await supabase.from("embarque_destinos").insert(
          dests.map((d,i)=>({embarque_id:emb.id,orden:i+1,cliente:d.cliente,cust_po:d.cust_po,warehouse_nombre:d.warehouse,direccion:d.direccion,telefono:d.telefono,tax_id:d.tax_id,fecha_entrega_est:d.fecha_entrega_est||null}))
        );
        if(dErr) throw dErr;
      }
      // 3 — pallets
      if(pallets.length>0){
        const {error:pErr}=await supabase.from("embarque_pallets").insert(
          pallets.map(p=>({embarque_id:emb.id,tag_numero:p.tag,lote:p.lote,variedad:p.variedad,presentacion:p.presentacion,label:p.label,calibre:p.calibre,fecha_cosecha:p.fecha||null,cajas:p.cajas,kg_neto:p.kg_neto||null,kg_bruto:p.kg_bruto||null,temp_carga:p.temp_carga||null}))
        );
        if(pErr) throw pErr;
      }
      // 4 — tracking inicial
      await supabase.from("embarque_tracking").insert({embarque_id:emb.id,etapa_nueva:"cooler",notas:"Embarque creado."});
      // 5 — recargar completo para UI
      const full=await fetchEmbarqueCompleto(emb.id);
      if(full) onCreate(full);
      onClose();
    }catch(err){ alert("Error al crear embarque: "+err.message); }
    finally{ setSaving(false); }
  };
  const totalCWiz=pallets.reduce((a,p)=>a+p.cajas,0);
  const totalKWiz=pallets.reduce((a,p)=>a+p.kg_neto,0).toFixed(1);

  return(
    <Modal title="Nuevo Embarque" onClose={onClose} width={760}>
      <div style={{display:"flex",gap:0,marginBottom:22,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
        {["1. Datos del Camión","2. Destino(s)","3. Pallets + Confirmar"].map((s,i)=>(
          <div key={i} style={{flex:1,padding:"9px 14px",textAlign:"center",background:i+1===step?T.teal+"18":i+1<step?T.teal+"08":T.surface,borderRight:i<2?`1px solid ${T.border}`:"none"}}>
            <div style={{fontSize:10,fontWeight:700,color:i+1<=step?T.teal:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{i+1<step?"✓ ":""}{s}</div>
          </div>
        ))}
      </div>

      {step===1&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Código de Embarque *"><Input value={data.codigo} onChange={v=>setF("codigo",v)} placeholder="ej: AM26006RB"/></FormField>
            <FormField label="Fecha de Salida *"><Input type="date" value={data.fecha_salida} onChange={v=>setF("fecha_salida",v)}/></FormField>
            <FormField label="Hora de Salida"><Input type="time" value={data.hora_salida} onChange={v=>setF("hora_salida",v)}/></FormField>
            <FormField label="N° Sello"><Input value={data.sello} onChange={v=>setF("sello",v)} placeholder="ej: 4421-B"/></FormField>
          </div>
          <Divider label="Tracto"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Marca"><Input value={data.tracto_marca} onChange={v=>setF("tracto_marca",v)} placeholder="ej: Marca Internacional"/></FormField>
            <FormField label="Placa *"><Input value={data.tracto_placa} onChange={v=>setF("tracto_placa",v)} placeholder="ej: 90-BG-1X"/></FormField>
          </div>
          <Divider label="Remolque / Reefer"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <FormField label="Marca"><Input value={data.remolque_marca} onChange={v=>setF("remolque_marca",v)} placeholder="ej: Utility"/></FormField>
            <FormField label="Placa *"><Input value={data.remolque_placa} onChange={v=>setF("remolque_placa",v)} placeholder="ej: 13-UW-1E"/></FormField>
            <FormField label="Thermo N°"><Input value={data.thermo} onChange={v=>setF("thermo",v)} placeholder="ej: 412"/></FormField>
          </div>
          <Divider label="Operador"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <FormField label="Nombre *"><Input value={data.operador} onChange={v=>setF("operador",v)} placeholder="ej: Antonio Ávalos"/></FormField>
            <FormField label="CAAT"><Input value={data.caat} onChange={v=>setF("caat",v)} placeholder="ej: 36ZN"/></FormField>
            <FormField label="Alpha"><Input value={data.alpha} onChange={v=>setF("alpha",v)} placeholder="ej: TEPA"/></FormField>
          </div>
        </div>
      )}

      {step===2&&(
        <div>
          {dests.map((dest,i)=>(
            <div key={dest.id} style={{marginBottom:16,padding:14,background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:T.teal}}>Destino {i+1}</span>
                {i>0&&<button onClick={()=>setDests(ds=>ds.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,cursor:"pointer"}}>✕ Quitar</button>}
              </div>
              <FormField label="Autocompletar desde catálogo">
                <select onChange={e=>autoFill(i,e.target.value)} style={{...S.input,marginBottom:10,appearance:"none"}}>
                  <option value="">— Seleccionar warehouse guardado —</option>
                  {catalogoDestinos.map(c=><option key={c.id} value={c.id}>{c.nombre} — {c.ciudad}, {c.estado}</option>)}
                </select>
              </FormField>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FormField label="Cliente / Comprador *"><Input value={dest.cliente} onChange={v=>setDest(i,"cliente",v)} placeholder="ej: Family Tree Farms..."/></FormField>
                <FormField label="Warehouse *"><Input value={dest.warehouse} onChange={v=>setDest(i,"warehouse",v)}/></FormField>
                <FormField label="Dirección"><Input value={dest.direccion} onChange={v=>setDest(i,"direccion",v)}/></FormField>
                <FormField label="Teléfono"><Input value={dest.telefono} onChange={v=>setDest(i,"telefono",v)}/></FormField>
                <FormField label="Tax ID"><Input value={dest.tax_id} onChange={v=>setDest(i,"tax_id",v)}/></FormField>
                <FormField label="Fecha Entrega Est."><Input type="date" value={dest.fecha_entrega_est} onChange={v=>setDest(i,"fecha_entrega_est",v)}/></FormField>
              </div>
            </div>
          ))}
          {dests.length<3&&<button onClick={()=>setDests(ds=>[...ds,{...BLANK_D,id:uid(),orden:ds.length+1}])} style={{...S.btn(),width:"100%",textAlign:"center"}}>+ Agregar Destino ({dests.length}/3)</button>}
        </div>
      )}

      {step===3&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            {[{l:"Embarque",v:data.codigo||"—",c:T.teal},{l:"Pallets",v:pallets.length,c:T.purple},{l:"Cajas",v:totalCWiz,c:T.green},{l:"KG",v:totalKWiz,c:T.amber}].map(k=>(
              <div key={k.l} style={{flex:1,minWidth:80,background:k.c+"0c",border:`1px solid ${k.c}25`,borderRadius:8,padding:"6px 12px"}}>
                <div style={{fontSize:9,color:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
                <div style={{fontSize:15,fontWeight:800,color:k.c,fontFamily:T.mono}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:T.surface,borderRadius:10,padding:12,marginBottom:12,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:12,fontWeight:700,color:T.txt1,marginBottom:10}}>+ Agregar Pallet</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              <FormField label="N° TAG *"><Input value={newP.tag} onChange={v=>setNewP({...newP,tag:v})} placeholder="2363298"/></FormField>
              <FormField label="Lote *"><Input value={newP.lote} onChange={v=>setNewP({...newP,lote:v})} placeholder="AM26004RB"/></FormField>
              <FormField label="Presentación">
                <Select value={newP.presentacion} onChange={v=>{
                  const kg=calcKgNeto(v,newP.cajas);
                  setNewP({...newP,presentacion:v,kg_neto:kg});
                }} options={PRESENTACIONES}/>
              </FormField>
              <FormField label="Label"><Select value={newP.label} onChange={v=>setNewP({...newP,label:v})} options={LABELS}/></FormField>
              <FormField label="Calibre"><Select value={newP.calibre} onChange={v=>setNewP({...newP,calibre:v})} options={CALIBRES}/></FormField>
              <FormField label="Fecha"><Input type="date" value={newP.fecha} onChange={v=>setNewP({...newP,fecha:v})}/></FormField>
              <FormField label="Cajas/Pallet">
                <Input type="number" value={newP.cajas} onChange={v=>{
                  const kg=calcKgNeto(newP.presentacion,v);
                  setNewP({...newP,cajas:v,kg_neto:kg});
                }}/>
              </FormField>
              <FormField label="KG Neto (auto)">
                <div style={{...S.input,background:T.bg,color:T.amber,fontWeight:700,cursor:"default",display:"flex",alignItems:"center"}}>
                  {newP.kg_neto||calcKgNeto(newP.presentacion,newP.cajas)||"—"}
                </div>
              </FormField>
            </div>
            <button onClick={addPallet} style={{...S.btn(T.teal),marginTop:6,fontSize:11}}>+ Agregar a la lista</button>
          </div>
          {pallets.length>0&&(
            <div style={{overflowX:"auto",borderRadius:8,border:`1px solid ${T.border}`}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:T.surface}}>
                  {["TAG","Lote","Present.","Label","Calibre","Fecha","Cajas","KG",""].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:T.txt3,fontWeight:700,fontSize:9,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>{pallets.map(p=>(
                  <tr key={p.id} style={{borderBottom:`1px solid ${T.border}30`}}>
                    <td style={{padding:"6px 10px",fontFamily:T.mono,color:T.teal,fontWeight:700}}>{p.tag}</td>
                    <td style={{padding:"6px 10px",fontFamily:T.mono,color:T.purple}}>{p.lote}</td>
                    <td style={{padding:"6px 10px",color:T.txt1}}>{p.presentacion}</td>
                    <td style={{padding:"6px 10px",color:T.txt2}}>{p.label}</td>
                    <td style={{padding:"6px 10px",color:T.green}}>{p.calibre}</td>
                    <td style={{padding:"6px 10px",color:T.txt2}}>{p.fecha||"—"}</td>
                    <td style={{padding:"6px 10px",color:T.txt1}}>{p.cajas}</td>
                    <td style={{padding:"6px 10px",color:T.amber}}>{p.kg_neto}</td>
                    <td><button onClick={()=>setPallets(ps=>ps.filter(x=>x.id!==p.id))} style={{background:"none",border:"none",color:T.txt3,cursor:"pointer"}}>✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
        <button onClick={step===1?onClose:()=>setStep(s=>s-1)} style={S.btn(T.txt3)}>{step===1?"Cancelar":"← Atrás"}</button>
        {step<3?<button onClick={()=>setStep(s=>s+1)} style={S.btnPrimary}>Siguiente →</button>
                :<button onClick={crear} disabled={saving} style={{...S.btnPrimary,background:T.green,color:"#03110a",opacity:saving?0.5:1}}>{saving?"Guardando…":"✅ Crear Embarque"}</button>}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REMITENTES TAB — Configuración de cuentas Gmail remitentes
═══════════════════════════════════════════════════════════════ */
function RemitentesTab(){
  const [remitentes,setRemitentes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [editR,setEditR]=useState(null);
  const [form,setForm]=useState({nombre_display:"",email:"",gmail_client_id:"",gmail_client_secret:"",gmail_refresh_token:"",notas:""});
  const [saving,setSaving]=useState(false);
  const [testing,setTesting]=useState(null); // id del que se está probando
  const [showGuia,setShowGuia]=useState(false);

  useEffect(()=>{ loadRemitentes(); },[]);

  const loadRemitentes=async()=>{
    setLoading(true);
    const {data,error}=await supabase.from("configuracion_remitente").select("*").order("created_at");
    if(error){
      console.error("Error cargando remitentes:",error);
      alert("Error al cargar remitentes:\n"+error.message+"\n\nAsegúrate de ejecutar el SQL 'fix_rls_remitentes.sql' en Supabase.");
    }
    if(data) setRemitentes(data);
    setLoading(false);
  };

  const openNew=()=>{
    setForm({nombre_display:"",email:"",gmail_client_id:"",gmail_client_secret:"",gmail_refresh_token:"",notas:""});
    setEditR(null);
    setModal(true);
  };
  const openEdit=(r)=>{
    setForm({nombre_display:r.nombre_display,email:r.email,gmail_client_id:r.gmail_client_id||"",gmail_client_secret:r.gmail_client_secret||"",gmail_refresh_token:r.gmail_refresh_token||"",notas:r.notas||""});
    setEditR(r);
    setModal(true);
  };

  const save=async()=>{
    if(!form.nombre_display||!form.email){ alert("Nombre y email son requeridos"); return; }
    setSaving(true);
    try{
      if(editR){
        await supabase.from("configuracion_remitente").update({...form,updated_at:new Date().toISOString()}).eq("id",editR.id);
      } else {
        await supabase.from("configuracion_remitente").insert({...form,activo:false,verificado:false});
      }
      setModal(false);
      await loadRemitentes();
    }catch(e){ alert("Error: "+e.message); }
    finally{ setSaving(false); }
  };

  const toggleActivo=async(r)=>{
    // Desactivar todos primero, luego activar solo este
    await supabase.from("configuracion_remitente").update({activo:false}).neq("id","00000000-0000-0000-0000-000000000000");
    if(!r.activo){
      await supabase.from("configuracion_remitente").update({activo:true}).eq("id",r.id);
    }
    await loadRemitentes();
  };

  const eliminar=async(id)=>{
    if(!window.confirm("¿Eliminar este remitente?")) return;
    await supabase.from("configuracion_remitente").delete().eq("id",id);
    await loadRemitentes();
  };

  const probarConexion=async(r)=>{
    if(!r.gmail_refresh_token){ alert("Primero configura el Refresh Token"); return; }
    setTesting(r.id);
    try{
      const {data,error}=await supabase.functions.invoke("send-email",{
        body:{
          embarque_id:"00000000-0000-0000-0000-000000000001",
          asunto:"✅ Prueba de conexión Gmail — Moray",
          cuerpo_html:`<p>Si recibes este correo, la conexión Gmail está funcionando correctamente.</p><p>Remitente configurado: <b>${r.email}</b></p><p>Fecha: ${new Date().toLocaleString("es-MX")}</p>`,
          destinatarios:[r.email],
          adjuntos:[],
        }
      });
      if(error||!data?.success) throw new Error(data?.error||error?.message||"Error desconocido");
      await supabase.from("configuracion_remitente").update({verificado:true}).eq("id",r.id);
      alert(`✅ Conexión exitosa. Se envió un correo de prueba a ${r.email}`);
      await loadRemitentes();
    }catch(e){
      alert("❌ Error de conexión:\n"+e.message);
    }finally{ setTesting(null); }
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:T.txt1}}>Cuentas Gmail Remitentes</div>
          <div style={{fontSize:11,color:T.txt3,marginTop:2}}>Solo la cuenta activa enviará los correos de los embarques</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowGuia(!showGuia)} style={{...S.btn(T.blue),fontSize:11}}>📖 Guía de configuración</button>
          <button onClick={openNew} style={S.btnPrimary}>+ Agregar remitente</button>
        </div>
      </div>

      {/* GUÍA RÁPIDA */}
      {showGuia&&(
        <div style={{background:T.card,border:`1px solid ${T.teal}30`,borderLeft:`3px solid ${T.teal}`,borderRadius:10,padding:18,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:800,color:T.teal,marginBottom:10}}>📖 Cómo conectar una cuenta Gmail — Paso a paso</div>
          {[
            ["1","Google Cloud Console","Ve a console.cloud.google.com → Nuevo proyecto → llámalo 'Moray Exportacion'"],
            ["2","Habilitar Gmail API","APIs y servicios → Biblioteca → busca 'Gmail API' → Habilitar"],
            ["3","Crear credenciales OAuth","APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth → Tipo: Aplicación web"],
            ["4","URIs de redirección","Agrega: https://developers.google.com/oauthplayground como URI autorizado"],
            ["5","Copiar Client ID y Secret","Anótalos. Los pegarás en el formulario de abajo."],
            ["6","Obtener Refresh Token","Ve a developers.google.com/oauthplayground → ⚙️ → marca 'Use your own OAuth credentials' → pega Client ID y Secret → en el buscador escribe 'Gmail API v1' → selecciona https://mail.google.com/ → Authorize APIs → inicia sesión con el Gmail que enviará → Exchange auth code for tokens → copia el Refresh Token"],
            ["7","Llenar el formulario","Pega Client ID, Client Secret y Refresh Token en 'Agregar remitente' abajo."],
            ["8","Probar conexión","Haz clic en 'Probar conexión' para verificar que funciona."],
          ].map(([n,titulo,desc])=>(
            <div key={n} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:T.teal+"20",border:`1px solid ${T.teal}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:T.teal,flexShrink:0}}>{n}</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.txt1}}>{titulo}</div>
                <div style={{fontSize:11,color:T.txt2,marginTop:2}}>{desc}</div>
              </div>
            </div>
          ))}
          <div style={{marginTop:12,padding:"10px 14px",background:T.amber+"10",border:`1px solid ${T.amber}30`,borderRadius:8}}>
            <div style={{fontSize:11,fontWeight:700,color:T.amber,marginBottom:4}}>⚠️ Importante sobre seguridad</div>
            <div style={{fontSize:11,color:T.txt2}}>El Refresh Token da acceso permanente a enviar correos desde esa cuenta. Úsala con una cuenta de correo dedicada (no personal) y revoca el acceso desde Google si dejas de usar la app. En Google Cloud, deja el proyecto en modo "Testing" con tu correo como usuario de prueba.</div>
          </div>
        </div>
      )}

      {/* LISTA DE REMITENTES */}
      {loading?(
        <div style={{textAlign:"center",padding:"30px",color:T.txt3}}>Cargando…</div>
      ):(
        <div style={{display:"grid",gap:10}}>
          {remitentes.map(r=>(
            <Card key={r.id} style={{borderLeft:`3px solid ${r.activo?T.green:T.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:T.txt1}}>{r.nombre_display}</span>
                    {r.activo&&<Badge text="✅ Activo" color={T.green}/>}
                    {r.verificado&&<Badge text="Verificado" color={T.teal}/>}
                    {!r.gmail_refresh_token&&<Badge text="⚠️ Sin configurar" color={T.amber}/>}
                  </div>
                  <div style={{fontSize:12,color:T.txt2}}>📧 {r.email}</div>
                  {r.notas&&<div style={{fontSize:11,color:T.txt3,marginTop:2}}>{r.notas}</div>}
                  {r.gmail_client_id&&(
                    <div style={{fontSize:10,color:T.txt3,marginTop:4,fontFamily:T.mono}}>
                      Client ID: {r.gmail_client_id.slice(0,20)}…
                      {r.gmail_refresh_token?" · Refresh Token: ✓":" · Refresh Token: ✗"}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <button onClick={()=>toggleActivo(r)} style={{...S.btn(r.activo?T.txt3:T.green),fontSize:11,padding:"4px 10px"}}>
                    {r.activo?"Desactivar":"Activar"}
                  </button>
                  <button onClick={()=>probarConexion(r)} disabled={testing===r.id||!r.gmail_refresh_token} style={{...S.btn(T.blue),fontSize:11,padding:"4px 10px",opacity:!r.gmail_refresh_token?0.4:1}}>
                    {testing===r.id?"Probando…":"🔌 Probar"}
                  </button>
                  <button onClick={()=>openEdit(r)} style={{...S.btn(T.teal),fontSize:11,padding:"4px 10px"}}>✏️ Editar</button>
                  <button onClick={()=>eliminar(r.id)} style={{background:"none",border:"none",color:T.txt3,cursor:"pointer",fontSize:16}}>🗑</button>
                </div>
              </div>
            </Card>
          ))}
          {remitentes.length===0&&(
            <div style={{textAlign:"center",padding:"40px",color:T.txt3,border:`1px dashed ${T.border}`,borderRadius:12}}>
              <div style={{fontSize:32,marginBottom:8}}>📧</div>
              <div style={{fontSize:13,marginBottom:4}}>Sin cuentas remitentes configuradas</div>
              <div style={{fontSize:11}}>Agrega una cuenta Gmail para poder enviar correos desde los embarques</div>
            </div>
          )}
        </div>
      )}

      {/* MODAL NUEVO/EDITAR REMITENTE */}
      {modal&&(
        <Modal title={editR?"Editar Remitente Gmail":"Nuevo Remitente Gmail"} onClose={()=>setModal(false)} width={680}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Nombre para mostrar *">
              <Input value={form.nombre_display} onChange={v=>setForm(f=>({...f,nombre_display:v}))} placeholder="ej: Exportaciones Moray"/>
            </FormField>
            <FormField label="Correo Gmail *">
              <Input value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="ej: exportacion@agricolamoray.com"/>
            </FormField>
          </div>
          <Divider label="Credenciales OAuth — Google Cloud Console"/>
          <div style={{marginBottom:12,padding:"10px 14px",background:T.card,borderRadius:8,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,color:T.txt3}}>Obtén estas credenciales en <span style={{color:T.teal,fontWeight:700}}>console.cloud.google.com</span> → Credenciales → OAuth 2.0. Haz clic en "📖 Guía de configuración" arriba para el paso a paso.</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Client ID">
              <Input value={form.gmail_client_id} onChange={v=>setForm(f=>({...f,gmail_client_id:v}))} placeholder="xxxxx.apps.googleusercontent.com"/>
            </FormField>
            <FormField label="Client Secret">
              <Input value={form.gmail_client_secret} onChange={v=>setForm(f=>({...f,gmail_client_secret:v}))} placeholder="GOCSPX-..."/>
            </FormField>
          </div>
          <div style={{marginTop:12}}>
            <FormField label="Refresh Token (de OAuth Playground)">
              <textarea
                value={form.gmail_refresh_token}
                onChange={e=>setForm(f=>({...f,gmail_refresh_token:e.target.value}))}
                placeholder="1//0g... (obtenido de developers.google.com/oauthplayground)"
                style={{...S.textarea,minHeight:80,fontSize:12}}
              />
            </FormField>
          </div>
          <div style={{marginTop:12}}>
            <FormField label="Notas internas">
              <Input value={form.notas} onChange={v=>setForm(f=>({...f,notas:v}))} placeholder="ej: Cuenta principal de exportación, usada para aviso de salida"/>
            </FormField>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
            <button onClick={()=>setModal(false)} style={S.btn(T.txt3)}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{...S.btnPrimary,opacity:saving?0.5:1}}>{saving?"Guardando…":editR?"Guardar Cambios":"Crear Remitente"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CATÁLOGOS
═══════════════════════════════════════════════════════════════ */
function CatalogosView({destinos,contactos,onUpdateDestinos,onUpdateContactos}){
  const [catTab,setCatTab]=useState("destinos");
  const [addDest,setAddDest]=useState(false);
  const [addCont,setAddCont]=useState(false);
  const [editDest,setEditDest]=useState(null); // destino being edited
  const [editCont,setEditCont]=useState(null); // contacto being edited
  const [newDest,setNewDest]=useState({nombre:"",direccion:"",ciudad:"",estado:"",cp:"",telefono:"",tax_id:"",email:""});
  const [newCont,setNewCont]=useState({nombre:"",empresa:"",rol:"cliente",email:"",es_fijo:false,activo:true});
  const ROLES=["agente_mx","agente_us","transportista","cliente","warehouse","trafico","interno"];

  const saveDest=()=>{
    if(editDest){
      onUpdateDestinos(destinos.map(d=>d.id===editDest.id?{...editDest,...newDest}:d));
      setEditDest(null);
    } else {
      onUpdateDestinos([...destinos,{...newDest,id:uid()}]);
    }
    setAddDest(false);
    setNewDest({nombre:"",direccion:"",ciudad:"",estado:"",cp:"",telefono:"",tax_id:"",email:""});
  };

  const startEditDest=(d)=>{
    setNewDest({nombre:d.nombre,direccion:d.direccion,ciudad:d.ciudad,estado:d.estado,cp:d.cp||"",telefono:d.telefono||"",tax_id:d.tax_id||"",email:d.email||""});
    setEditDest(d);
    setAddDest(true);
  };

  const saveCont=()=>{
    if(editCont){
      onUpdateContactos(contactos.map(c=>c.id===editCont.id?{...editCont,...newCont}:c));
      setEditCont(null);
    } else {
      onUpdateContactos([...contactos,{...newCont,id:uid()}]);
    }
    setAddCont(false);
    setNewCont({nombre:"",empresa:"",rol:"cliente",email:"",es_fijo:false,activo:true});
  };

  const startEditCont=(c)=>{
    setNewCont({nombre:c.nombre,empresa:c.empresa||"",rol:c.rol,email:c.email,es_fijo:c.es_fijo,activo:c.activo});
    setEditCont(c);
    setAddCont(true);
  };

  const cancelDest=()=>{ setAddDest(false); setEditDest(null); setNewDest({nombre:"",direccion:"",ciudad:"",estado:"",cp:"",telefono:"",tax_id:"",email:""}); };
  const cancelCont=()=>{ setAddCont(false); setEditCont(null); setNewCont({nombre:"",empresa:"",rol:"cliente",email:"",es_fijo:false,activo:true}); };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:18,fontWeight:800,color:T.txt1}}>Catálogos</div>
        {catTab!=="remitentes"&&(
          <button onClick={()=>catTab==="destinos"?setAddDest(true):setAddCont(true)} style={S.btnPrimary}>
            + Nuevo {catTab==="destinos"?"Destino":"Contacto"}
          </button>
        )}
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
        {[["destinos","🏭 Warehouses"],["contactos","👥 Contactos"],["remitentes","📧 Remitentes"]].map(([k,l])=>(
          <button key={k} onClick={()=>setCatTab(k)} style={{background:"none",border:"none",borderBottom:catTab===k?`2px solid ${T.teal}`:"2px solid transparent",color:catTab===k?T.teal:T.txt3,padding:"10px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      <div style={{padding:"16px 20px"}}>
        {catTab==="remitentes"&&<RemitentesTab/>}
        {catTab==="destinos"&&<div style={{display:"grid",gap:10}}>
          {destinos.map(d=>(
            <Card key={d.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.txt1}}>{d.nombre}</div>
                  <div style={{fontSize:12,color:T.txt2,marginTop:4}}>{d.direccion}{d.ciudad?`, ${d.ciudad}`:""}{d.estado?`, ${d.estado}`:""}{d.cp?` ${d.cp}`:""}</div>
                  <div style={{fontSize:11,color:T.txt3,marginTop:2}}>📞 {d.telefono||"—"} · Tax ID: {d.tax_id||"—"} · {d.email||"—"}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:12}}>
                  <button onClick={()=>startEditDest(d)} style={{...S.btn(T.blue),padding:"4px 10px",fontSize:11}}>✏️ Editar</button>
                  <button onClick={()=>onUpdateDestinos(destinos.filter(x=>x.id!==d.id))} style={{background:"none",border:"none",color:T.txt3,cursor:"pointer",fontSize:16}}>🗑</button>
                </div>
              </div>
            </Card>
          ))}
          {destinos.length===0&&<div style={{textAlign:"center",padding:"40px",color:T.txt3,fontSize:13,border:`1px dashed ${T.border}`,borderRadius:12}}>Sin warehouses registrados</div>}
        </div>}

        {catTab==="contactos"&&<div style={{display:"grid",gap:10}}>
          {contactos.map(c=>(
            <Card key={c.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:(ROL_COLORS[c.rol]||T.txt2)+"20",border:`2px solid ${(ROL_COLORS[c.rol]||T.txt2)}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:ROL_COLORS[c.rol]||T.txt2}}>{c.nombre.charAt(0)}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:T.txt1}}>{c.nombre} <span style={{fontSize:11,color:T.txt3}}>· {c.empresa}</span></div>
                    <div style={{fontSize:11,color:T.txt2}}>{c.email}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Badge text={ROL_LABELS[c.rol]||c.rol} color={ROL_COLORS[c.rol]||T.txt2}/>
                  {c.es_fijo&&<Badge text="Fijo" color={T.teal}/>}
                  <button onClick={()=>startEditCont(c)} style={{...S.btn(T.blue),padding:"4px 10px",fontSize:11}}>✏️ Editar</button>
                  <button onClick={()=>onUpdateContactos(contactos.filter(x=>x.id!==c.id))} style={{background:"none",border:"none",color:T.txt3,cursor:"pointer",fontSize:16}}>🗑</button>
                </div>
              </div>
            </Card>
          ))}
          {contactos.length===0&&<div style={{textAlign:"center",padding:"40px",color:T.txt3,fontSize:13,border:`1px dashed ${T.border}`,borderRadius:12}}>Sin contactos registrados</div>}
        </div>}
      </div>

      {/* Modal Destino (nuevo o edición) */}
      {addDest&&<Modal title={editDest?"Editar Destino / Warehouse":"Nuevo Destino / Warehouse"} onClose={cancelDest}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["nombre","Nombre *","ej: Rio Bravo Packing..."],["direccion","Dirección","5316 S Stewart Rd"],["ciudad","Ciudad","San Juan"],["estado","Estado","TX"],["cp","Código Postal","78589"],["telefono","Teléfono","(956) 843-6200"],["tax_id","Tax ID",""],["email","Email",""]].map(([k,l,p])=>(
            <FormField key={k} label={l}><Input value={newDest[k]} onChange={v=>setNewDest(d=>({...d,[k]:v}))} placeholder={p||""}/></FormField>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}>
          <button onClick={cancelDest} style={S.btn(T.txt3)}>Cancelar</button>
          <button onClick={saveDest} style={S.btnPrimary}>{editDest?"Guardar Cambios":"Crear Warehouse"}</button>
        </div>
      </Modal>}

      {/* Modal Contacto (nuevo o edición) */}
      {addCont&&<Modal title={editCont?"Editar Contacto":"Nuevo Contacto"} onClose={cancelCont}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FormField label="Nombre *"><Input value={newCont.nombre} onChange={v=>setNewCont(c=>({...c,nombre:v}))}/></FormField>
          <FormField label="Empresa"><Input value={newCont.empresa} onChange={v=>setNewCont(c=>({...c,empresa:v}))}/></FormField>
          <FormField label="Rol"><Select value={newCont.rol} onChange={v=>setNewCont(c=>({...c,rol:v}))} options={ROLES.map(r=>({value:r,label:ROL_LABELS[r]||r}))}/></FormField>
          <FormField label="Email *"><Input value={newCont.email} onChange={v=>setNewCont(c=>({...c,email:v}))}/></FormField>
          <div style={{display:"flex",alignItems:"center",gap:8,gridColumn:"1/-1"}}>
            <input type="checkbox" checked={newCont.es_fijo} onChange={e=>setNewCont(c=>({...c,es_fijo:e.target.checked}))} id="fijo"/>
            <label htmlFor="fijo" style={{...S.label,margin:0,cursor:"pointer",textTransform:"none",fontSize:12}}>Contacto fijo (pre-seleccionado en todos los correos)</label>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}>
          <button onClick={cancelCont} style={S.btn(T.txt3)}>Cancelar</button>
          <button onClick={saveCont} style={S.btnPrimary}>{editCont?"Guardar Cambios":"Crear Contacto"}</button>
        </div>
      </Modal>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FASE 3 — DASHBOARD, PACKING LIST, REPORTES
═══════════════════════════════════════════════════════════════ */

/* ─── PACKING LIST MODAL ──────────────────────────────────────
   Genera un packing list imprimible desde los pallets del embarque
   Formato basado en el Shipping Register de Family Tree Farms
─────────────────────────────────────────────────────────────── */
function PackingListModal({ embarque: e, onClose }) {
  const totCajas = totalCajas(e);
  const totKgNeto = totalKg(e);
  const totKgBruto = e.pallets.reduce((a, p) => a + (p.kg_bruto || 0), 0).toFixed(1);
  const dest = e.destinos[0] || {};

  const printStyle = `
    @media print {
      body * { visibility: hidden; }
      #pl-print, #pl-print * { visibility: visible; }
      #pl-print { position: fixed; top: 0; left: 0; width: 100%; font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
      .no-print { display: none !important; }
    }
  `;

  return (
    <Modal title="Packing List" onClose={onClose} width={860}>
      <style>{printStyle}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 16, justifyContent: "flex-end" }}>
        <button onClick={() => window.print()} style={{ ...S.btnPrimary, background: T.blue }}>🖨 Imprimir / Guardar PDF</button>
        <button onClick={onClose} style={S.btn(T.txt3)}>Cerrar</button>
      </div>

      {/* Printable content */}
      <div id="pl-print" style={{ background: "#fff", color: "#111", padding: "20px 24px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12, lineHeight: 1.6 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: "2px solid #111", paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>PACKING LIST</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Agricola Moray — Exportación de Berries</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{e.codigo}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Fecha: {fmt(e.fecha_salida)}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Salida: {e.hora_salida} hs</div>
          </div>
        </div>

        {/* Shipper / Consignee */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
          <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#555", marginBottom: 6 }}>Shipper / Exportador</div>
            <div style={{ fontWeight: 700 }}>Agricola Moray</div>
            <div>Exportación de Arándanos</div>
            <div>México</div>
          </div>
          <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#555", marginBottom: 6 }}>Consignee / Destinatario</div>
            <div style={{ fontWeight: 700 }}>{dest.cliente || "—"}</div>
            <div>{dest.direccion || "—"}</div>
            {dest.telefono && <div>Tel: {dest.telefono}</div>}
            {dest.tax_id && <div>Tax ID: {dest.tax_id}</div>}
          </div>
        </div>

        {/* Transport info */}
        <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "10px 14px", marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { l: "Tracto / Placa",     v: `${e.tracto_marca} / ${e.tracto_placa}` },
            { l: "Remolque / Placa",   v: `${e.remolque_marca} / ${e.remolque_placa}` },
            { l: "Thermo",             v: e.thermo },
            { l: "Operador",           v: e.operador },
            { l: "CAAT",               v: e.caat },
            { l: "Alpha",              v: e.alpha },
            { l: "Sello",              v: e.sello || "—" },
            { l: "Cust PO",            v: dest.cust_po || "—" },
          ].map(k => (
            <div key={k.l}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#777" }}>{k.l}</div>
              <div style={{ fontWeight: 600 }}>{k.v || "—"}</div>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { l: "Total Pallets", v: e.pallets.length, bold: true },
            { l: "Total Cajas",   v: totCajas,          bold: true },
            { l: "KG Neto",       v: `${totKgNeto} kg`, bold: true },
            { l: "KG Bruto",      v: `${totKgBruto} kg`,bold: true },
          ].map(k => (
            <div key={k.l} style={{ background: "#f4f6f9", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#777" }}>{k.l}</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Pallets table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#1a2a3a", color: "#fff" }}>
              {["#", "N° TAG", "Lote", "Variedad", "Presentación", "Label", "Calibre", "Fecha Cosecha", "Cajas/Pallet", "KG Neto", "KG Bruto"].map(h => (
                <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {e.pallets.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #e0e5ec", background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: "6px 10px", color: "#888", fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: 700, color: "#1a4a7a" }}>{p.tag}</td>
                <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#555" }}>{p.lote}</td>
                <td style={{ padding: "6px 10px" }}>{p.variedad || "—"}</td>
                <td style={{ padding: "6px 10px", fontWeight: 600 }}>{p.presentacion}</td>
                <td style={{ padding: "6px 10px" }}>{p.label}</td>
                <td style={{ padding: "6px 10px", fontWeight: 600 }}>{p.calibre}</td>
                <td style={{ padding: "6px 10px" }}>{fmt(p.fecha)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{p.cajas}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{p.kg_neto || "—"}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{p.kg_bruto || "—"}</td>
              </tr>
            ))}
            <tr style={{ background: "#1a2a3a", color: "#fff", fontWeight: 800 }}>
              <td colSpan={8} style={{ padding: "8px 10px", fontSize: 11, textAlign: "right" }}>TOTAL</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 13 }}>{totCajas}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 13 }}>{totKgNeto}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 13 }}>{totKgBruto}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, paddingTop: 16, borderTop: "1px solid #ddd" }}>
          {["Preparado por", "Revisado por", "Recibido en destino"].map(l => (
            <div key={l} style={{ borderTop: "1px solid #999", paddingTop: 4 }}>
              <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
              <div style={{ height: 32 }} />
              <div style={{ fontSize: 9, color: "#aaa" }}>Firma / Fecha</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 9, color: "#aaa", textAlign: "center" }}>
          Generado: {new Date().toLocaleString("es-MX")} · Agricola Moray · Módulo de Exportación
        </div>
      </div>
    </Modal>
  );
}

/* ─── DASHBOARD VIEW ──────────────────────────────────────────
   Fase 3: KPIs, alertas, actividad reciente, reportes
─────────────────────────────────────────────────────────────── */
function DashboardView({ embarques, onSelectEmbarque }) {

  // ── KPIs ──────────────────────────────────────────────────
  const activos    = useMemo(() => embarques.filter(e => e.status !== "entregado"), [embarques]);
  const entregados = useMemo(() => embarques.filter(e => e.status === "entregado"), [embarques]);
  const enTransito = useMemo(() => embarques.filter(e => e.status === "transito"),  [embarques]);

  const kgTotalExportado = useMemo(() =>
    entregados.reduce((a, e) => a + parseFloat(totalKg(e)), 0).toFixed(0),
    [entregados]);

  const cajasEstaSemana = useMemo(() => {
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
    return embarques
      .filter(e => e.status === "entregado" && new Date(e.fecha_salida) >= hace7)
      .reduce((a, e) => a + totalCajas(e), 0);
  }, [embarques]);

  const totalCorreos = useMemo(() =>
    embarques.reduce((a, e) => a + e.correos.length, 0), [embarques]);

  const totalDocs = useMemo(() =>
    embarques.reduce((a, e) => a + Object.keys(e.documentos).length, 0), [embarques]);

  // ── Distribución por etapa para gráfica ───────────────────
  const stageData = useMemo(() => STAGES.map(s => ({
    name: s.name,
    icon: s.icon,
    count: embarques.filter(e => e.status === s.id).length,
    color: s.color,
  })), [embarques]);

  // ── Alertas: embarques "estancados" (último tracking > 12h) ─
  const alertas = useMemo(() => {
    const now = Date.now();
    return activos.filter(e => {
      if (e.tracking.length === 0) return true;
      const ultimo = new Date(e.tracking[e.tracking.length - 1].fecha.replace(" ", "T")).getTime();
      const horas = (now - ultimo) / 3600000;
      return horas > 12;
    });
  }, [activos]);

  // ── Actividad reciente (últimos 15 eventos de tracking) ───
  const actividadReciente = useMemo(() => {
    const eventos = embarques.flatMap(e =>
      e.tracking.map(t => ({ ...t, embarque_codigo: e.codigo, embarque_id: e.id, embarque_status: e.status }))
    );
    return eventos
      .sort((a, b) => new Date(b.fecha.replace(" ", "T")) - new Date(a.fecha.replace(" ", "T")))
      .slice(0, 12);
  }, [embarques]);

  // ── Resumen de docs faltantes por embarque activo ─────────
  const docsPendientes = useMemo(() =>
    activos
      .map(e => {
        const reqs = Object.values(DOCS_REQUERIDOS).flat().filter(d => d.req);
        const faltantes = reqs.filter(d => e.documentos[d.key]?.status !== "subido");
        return { ...e, faltantes: faltantes.length };
      })
      .filter(e => e.faltantes > 0)
      .sort((a, b) => b.faltantes - a.faltantes),
    [activos]);

  // ── Top clientes por kg exportado ────────────────────────
  const topClientes = useMemo(() => {
    const map = {};
    embarques.forEach(e => {
      const c = e.destinos[0]?.cliente || "Sin cliente";
      const kg = parseFloat(totalKg(e));
      if (!map[c]) map[c] = { cliente: c, kg: 0, embarques: 0 };
      map[c].kg += kg; map[c].embarques++;
    });
    return Object.values(map).sort((a, b) => b.kg - a.kg).slice(0, 5);
  }, [embarques]);

  const KPI = ({ label, value, sub, color, icon }) => (
    <div style={{ background: T.card, border: `1px solid ${color}30`, borderRadius: 14, padding: "16px 20px", borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: T.txt2, marginTop: 4 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 28, opacity: 0.6 }}>{icon}</span>
      </div>
    </div>
  );

  const SectionHead = ({ title, sub }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.txt1 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "20px 24px" }}>

      {/* Page title */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: T.txt1 }}>Dashboard de Exportación</div>
        <div style={{ fontSize: 12, color: T.txt3, marginTop: 3 }}>
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPI label="Activos" value={activos.length} sub={`${enTransito.length} en tránsito`} color={T.teal} icon="🚛" />
        <KPI label="Entregados" value={entregados.length} sub="histórico total" color={T.green} icon="✅" />
        <KPI label="KG Exportados" value={`${(parseFloat(kgTotalExportado)/1000).toFixed(1)}t`} sub="histórico total" color={T.amber} icon="⚖️" />
        <KPI label="Correos Enviados" value={totalCorreos} sub={`${totalDocs} documentos subidos`} color={T.purple} icon="✉️" />
      </div>

      {/* ── Row 2: gráfica + alertas ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Distribución por etapa */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <SectionHead title="Distribución por Etapa" sub="Embarques activos + entregados" />
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                <XAxis dataKey="name" tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.txt1 }}
                  cursor={{ fill: T.teal + "15" }}
                  formatter={(v, n, p) => [`${v} embarques`, p.payload.icon + " " + p.payload.name]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend dots */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            {stageData.map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                <span style={{ fontSize: 10, color: T.txt3 }}>{s.icon} {s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div style={{ background: T.card, border: `1px solid ${alertas.length > 0 ? T.red + "40" : T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <SectionHead
            title={alertas.length > 0 ? `⚠️ ${alertas.length} Alerta${alertas.length > 1 ? "s" : ""}` : "✅ Sin Alertas"}
            sub="Embarques sin movimiento >12 horas"
          />
          {alertas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: T.txt3, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🟢</div>
              Todos los embarques activos tienen actividad reciente.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {alertas.map(e => {
                const st = stageOf(e.status);
                const ultimo = e.tracking[e.tracking.length - 1];
                const horas = ultimo
                  ? Math.round((Date.now() - new Date(ultimo.fecha.replace(" ", "T")).getTime()) / 3600000)
                  : "??";
                return (
                  <div key={e.id} onClick={() => onSelectEmbarque(e)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                    background: T.red + "08", border: `1px solid ${T.red}30`,
                    transition: "border-color .15s",
                  }}
                  onMouseEnter={el => el.currentTarget.style.borderColor = T.red + "70"}
                  onMouseLeave={el => el.currentTarget.style.borderColor = T.red + "30"}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.red, fontSize: 12 }}>{e.codigo}</span>
                        <Badge text={`${st.icon} ${st.name}`} color={st.color} />
                      </div>
                      <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>{e.destinos[0]?.cliente?.split(" ").slice(0, 3).join(" ")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.red }}>{horas}h</div>
                      <div style={{ fontSize: 9, color: T.txt3 }}>sin avance</div>
                    </div>
                    <span style={{ fontSize: 14, color: T.txt3 }}>›</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: docs pendientes + top clientes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Docs faltantes */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <SectionHead title="📋 Documentos Pendientes" sub="Embarques activos con docs faltantes" />
          {docsPendientes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: T.txt3, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              Sin documentos pendientes en embarques activos.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 220, overflowY: "auto" }}>
              {docsPendientes.map(e => {
                const st = stageOf(e.status);
                const pct = Math.round((1 - e.faltantes / Object.values(DOCS_REQUERIDOS).flat().filter(d => d.req).length) * 100);
                return (
                  <div key={e.id} onClick={() => onSelectEmbarque(e)} style={{
                    padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                    background: T.surface, border: `1px solid ${T.border}`,
                  }}
                  onMouseEnter={el => el.currentTarget.style.borderColor = T.amber + "60"}
                  onMouseLeave={el => el.currentTarget.style.borderColor = T.border}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.amber, fontSize: 12 }}>{e.codigo}</span>
                        <Badge text={`${st.icon} ${st.name}`} color={st.color} />
                      </div>
                      <Badge text={`⚠️ ${e.faltantes} faltan`} color={T.amber} />
                    </div>
                    <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct > 75 ? T.green : pct > 40 ? T.amber : T.red, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top clientes */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <SectionHead title="🏆 Top Clientes" sub="Por KG exportados (histórico)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topClientes.map((c, i) => {
              const maxKg = topClientes[0]?.kg || 1;
              const pct = (c.kg / maxKg) * 100;
              return (
                <div key={c.cliente}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? T.amber : T.txt3 }}>#{i + 1}</span>
                      <span style={{ fontSize: 12, color: T.txt1, fontWeight: i === 0 ? 700 : 400 }}>{c.cliente.split(" ").slice(0, 3).join(" ")}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.teal }}>{c.kg.toFixed(0)} kg</span>
                      <span style={{ fontSize: 10, color: T.txt3, marginLeft: 6 }}>{c.embarques} emb.</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: i === 0 ? T.amber : T.teal, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Actividad Reciente ── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
        <SectionHead title="🕐 Actividad Reciente" sub="Últimos eventos de tracking de todos los embarques" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {actividadReciente.map(t => {
            const st = stageOf(t.etapa);
            return (
              <div key={t.id} onClick={() => {
                const emb = embarques.find(e => e.id === t.embarque_id);
                if (emb) onSelectEmbarque(emb);
              }} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                background: T.surface, border: `1px solid ${T.border}`,
                transition: "border-color .15s",
              }}
              onMouseEnter={el => el.currentTarget.style.borderColor = st.color + "50"}
              onMouseLeave={el => el.currentTarget.style.borderColor = T.border}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: st.color + "20", border: `2px solid ${st.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{st.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: st.color }}>{t.embarque_codigo}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{st.name}</span>
                    {t.temp != null && <Badge text={`${t.temp}°C`} color={t.temp > 4 ? T.red : t.temp > 2 ? T.amber : T.blue} />}
                  </div>
                  <div style={{ fontSize: 11, color: T.txt2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notas}</div>
                  <div style={{ fontSize: 9, color: T.txt3, marginTop: 1 }}>{t.fecha} · {t.usuario}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WIZARD EDITAR EMBARQUE
   Mismo wizard que NuevoEmbarque pero pre-llenado y con aprobación
═══════════════════════════════════════════════════════════════ */
function WizardEditarEmbarque({embarque:orig,onClose,onSaved,onRequestApproval,catalogoDestinos}){
  const {canExecute}=usePermissionsForJSX();
  const [step,setStep]=useState(1);
  // Pre-llenar con datos actuales
  const [data,setData]=useState({
    codigo:orig.codigo,
    fecha_salida:orig.fecha_salida,
    hora_salida:orig.hora_salida||"00:30",
    tracto_marca:orig.tracto_marca||"",
    tracto_placa:orig.tracto_placa||"",
    remolque_marca:orig.remolque_marca||"",
    remolque_placa:orig.remolque_placa||"",
    thermo:orig.thermo||"",
    operador:orig.operador||"",
    caat:orig.caat||"",
    alpha:orig.alpha||"",
    sello:orig.sello||"",
    notas:orig.notas||"",
  });
  const [dests,setDests]=useState(
    orig.destinos.length>0
      ? orig.destinos.map(d=>({id:d.id,orden:d.orden,cliente:d.cliente,cust_po:d.cust_po||"",warehouse:d.warehouse||"",direccion:d.direccion||"",telefono:d.telefono||"",tax_id:d.tax_id||"",fecha_entrega_est:d.fecha_entrega_est||""}))
      : [{...BLANK_D,id:uid(),orden:1}]
  );
  // Pallets — pre-cargados del embarque existente, editables
  const [pallets,setPallets]=useState(orig.pallets.map(p=>({...p})));
  const [newP,setNewP]=useState({...BLANK_P,id:uid()});
  const [savingPallet,setSavingPallet]=useState(false);
  const [saving,setSaving]=useState(false);

  const calcKgNeto=(presentacion,cajas)=>{ const f=KG_POR_CAJA[presentacion]; return f?(Number(cajas)*f).toFixed(1):""; };

  const addPalletLocal=()=>{
    if(!newP.tag)return;
    const kg=calcKgNeto(newP.presentacion,newP.cajas);
    setPallets(ps=>[...ps,{...newP,id:uid(),cajas:Number(newP.cajas),kg_neto:Number(kg)||0,kg_bruto:Number(newP.kg_bruto)||0,temp_carga:Number(newP.temp_carga)||null}]);
    setNewP(p=>({...p,id:uid(),tag:"",kg_bruto:"",temp_carga:""}));
  };

  const removePalletLocal=(id)=>setPallets(ps=>ps.filter(p=>p.id!==id));

  const totalCE=pallets.reduce((a,p)=>a+p.cajas,0);
  const totalKE=pallets.reduce((a,p)=>a+(p.kg_neto||0),0).toFixed(1);

  const setF=(k,v)=>setData(d=>({...d,[k]:v}));
  const setDest=(i,k,v)=>{const ds=[...dests];ds[i]={...ds[i],[k]:v};setDests(ds);};
  const autoFill=(i,catId)=>{
    const c=catalogoDestinos.find(x=>x.id===catId);
    if(!c)return;
    const ds=[...dests];
    ds[i]={...ds[i],cliente:c.nombre,warehouse:c.nombre,
      direccion:`${c.direccion||""}, ${c.ciudad||""}, ${c.estado||""} ${c.cp||""}`.replace(/^,\s*/,"").trim(),
      telefono:c.telefono||"",tax_id:c.tax_id||""};
    setDests(ds);
  };

  const doSave=async()=>{
    if(!data.fecha_salida){alert("Fecha de salida requerida");return;}
    setSaving(true);
    try{
      // Actualizar embarque principal
      const {error:embErr}=await supabase.from("embarques").update({
        fecha_salida:data.fecha_salida,
        hora_salida:data.hora_salida||null,
        tracto_marca:data.tracto_marca,tracto_placa:data.tracto_placa,
        remolque_marca:data.remolque_marca,remolque_placa:data.remolque_placa,
        thermo:data.thermo,operador:data.operador,caat:data.caat,alpha:data.alpha,
        sello_numero:data.sello,notas:data.notas,
        updated_at:new Date().toISOString(),
      }).eq("id",orig.id);
      if(embErr) throw embErr;

      // Actualizar / reemplazar destinos
      await supabase.from("embarque_destinos").delete().eq("embarque_id",orig.id);
      if(dests.length>0){
        const {error:dErr}=await supabase.from("embarque_destinos").insert(
          dests.map((d,i)=>({embarque_id:orig.id,orden:i+1,cliente:d.cliente,
            cust_po:d.cust_po,warehouse_nombre:d.warehouse,direccion:d.direccion,
            telefono:d.telefono,tax_id:d.tax_id,fecha_entrega_est:d.fecha_entrega_est||null}))
        );
        if(dErr) throw dErr;
      }
      // Sincronizar pallets: eliminar todos y reinsertar los editados
      await supabase.from("embarque_pallets").delete().eq("embarque_id",orig.id);
      if(pallets.length>0){
        const {error:pErr}=await supabase.from("embarque_pallets").insert(
          pallets.map(p=>({
            embarque_id:orig.id,tag_numero:p.tag,lote:p.lote,variedad:p.variedad,
            presentacion:p.presentacion,label:p.label,calibre:p.calibre,
            fecha_cosecha:p.fecha||null,cajas:p.cajas,
            kg_neto:p.kg_neto||null,kg_bruto:p.kg_bruto||null,temp_carga:p.temp_carga||null,
          }))
        );
        if(pErr) throw pErr;
      }
      // Registrar tracking
      await supabase.from("embarque_tracking").insert({
        embarque_id:orig.id,etapa_nueva:orig.status,
        notas:`Embarque editado: ${pallets.length} pallet${pallets.length!==1?"s":""}.`
      });
      const full=await fetchEmbarqueCompleto(orig.id);
      if(full) onSaved(full);
    }catch(err){ alert("Error al guardar: "+err.message); }
    finally{ setSaving(false); }
  };

  const handleConfirmar=()=>{
    // La edición de un embarque es acción sensible — requiere aprobación
    const result=canExecute("exportacion.embarque.edit");
    if(result==="needs_approval"){
      if(onRequestApproval){
        onRequestApproval({
          action_key:"exportacion.embarque.edit",
          context_id:orig.id,
          context_data:{
            embarque:orig.codigo,
            destino:dests[0]?.cliente||"—",
            campos_editados:"Datos del camión y destinos",
          },
          title:"Editar embarque",
          description:`La edición del embarque ${orig.codigo} requiere autorización del administrador.`,
          onApproved:()=>doSave(),
        });
        onClose(); // Cerrar wizard al solicitar
      }
      return;
    }
    doSave();
  };

  return(
    <Modal title="✏️ Editar Embarque" onClose={onClose} width={760}>
      <div style={{display:"flex",gap:0,marginBottom:22,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
        {["1. Datos del Camión","2. Destino(s)","3. Pallets","4. Confirmar"].map((s,i)=>(
          <div key={i} style={{flex:1,padding:"9px 14px",textAlign:"center",background:i+1===step?T.teal+"18":i+1<step?T.teal+"08":T.surface,borderRight:i<3?`1px solid ${T.border}`:"none"}}>
            <div style={{fontSize:10,fontWeight:700,color:i+1<=step?T.teal:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{i+1<step?"✓ ":""}{s}</div>
          </div>
        ))}
      </div>

      {step===1&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Código de Embarque">
              <div style={{...S.input,background:T.bg,color:T.txt3,cursor:"default",display:"flex",alignItems:"center"}}>{data.codigo}</div>
            </FormField>
            <FormField label="Fecha de Salida *"><Input type="date" value={data.fecha_salida} onChange={v=>setF("fecha_salida",v)}/></FormField>
            <FormField label="Hora de Salida"><Input type="time" value={data.hora_salida} onChange={v=>setF("hora_salida",v)}/></FormField>
            <FormField label="N° Sello"><Input value={data.sello} onChange={v=>setF("sello",v)} placeholder="ej: 4421-B"/></FormField>
          </div>
          <Divider label="Tracto"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Marca"><Input value={data.tracto_marca} onChange={v=>setF("tracto_marca",v)}/></FormField>
            <FormField label="Placa *"><Input value={data.tracto_placa} onChange={v=>setF("tracto_placa",v)}/></FormField>
          </div>
          <Divider label="Remolque / Reefer"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <FormField label="Marca"><Input value={data.remolque_marca} onChange={v=>setF("remolque_marca",v)}/></FormField>
            <FormField label="Placa *"><Input value={data.remolque_placa} onChange={v=>setF("remolque_placa",v)}/></FormField>
            <FormField label="Thermo N°"><Input value={data.thermo} onChange={v=>setF("thermo",v)}/></FormField>
          </div>
          <Divider label="Operador"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <FormField label="Nombre *"><Input value={data.operador} onChange={v=>setF("operador",v)}/></FormField>
            <FormField label="CAAT"><Input value={data.caat} onChange={v=>setF("caat",v)}/></FormField>
            <FormField label="Alpha"><Input value={data.alpha} onChange={v=>setF("alpha",v)}/></FormField>
          </div>
        </div>
      )}

      {step===2&&(
        <div>
          {dests.map((dest,i)=>(
            <div key={dest.id||i} style={{marginBottom:16,padding:14,background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:T.teal}}>Destino {i+1}</span>
                {i>0&&<button onClick={()=>setDests(ds=>ds.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,cursor:"pointer"}}>✕ Quitar</button>}
              </div>
              <FormField label="Autocompletar desde catálogo">
                <select onChange={ev=>autoFill(i,ev.target.value)} style={{...S.input,marginBottom:10,appearance:"none"}}>
                  <option value="">— Seleccionar warehouse guardado —</option>
                  {catalogoDestinos.map(c=><option key={c.id} value={c.id}>{c.nombre} — {c.ciudad}, {c.estado}</option>)}
                </select>
              </FormField>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FormField label="Cliente / Comprador *"><Input value={dest.cliente} onChange={v=>setDest(i,"cliente",v)}/></FormField>
                <FormField label="Warehouse *"><Input value={dest.warehouse} onChange={v=>setDest(i,"warehouse",v)}/></FormField>
                <FormField label="Dirección"><Input value={dest.direccion} onChange={v=>setDest(i,"direccion",v)}/></FormField>
                <FormField label="Teléfono"><Input value={dest.telefono} onChange={v=>setDest(i,"telefono",v)}/></FormField>
                <FormField label="Tax ID"><Input value={dest.tax_id} onChange={v=>setDest(i,"tax_id",v)}/></FormField>
                <FormField label="Fecha Entrega Est."><Input type="date" value={dest.fecha_entrega_est} onChange={v=>setDest(i,"fecha_entrega_est",v)}/></FormField>
              </div>
            </div>
          ))}
          {dests.length<3&&<button onClick={()=>setDests(ds=>[...ds,{...BLANK_D,id:uid(),orden:ds.length+1}])} style={{...S.btn(),width:"100%",textAlign:"center"}}>+ Agregar Destino ({dests.length}/3)</button>}
        </div>
      )}

      {step===3&&(
        <div>
          {/* Resumen de totales */}
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            {[{l:"Pallets",v:pallets.length,c:T.purple},{l:"Cajas",v:totalCE,c:T.green},{l:"KG Neto",v:totalKE,c:T.amber}].map(k=>(
              <div key={k.l} style={{flex:1,minWidth:80,background:k.c+"0c",border:`1px solid ${k.c}25`,borderRadius:8,padding:"6px 12px"}}>
                <div style={{fontSize:9,color:T.txt3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
                <div style={{fontSize:15,fontWeight:800,color:k.c,fontFamily:T.mono}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Agregar pallet nuevo */}
          <div style={{background:T.surface,borderRadius:10,padding:12,marginBottom:12,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:12,fontWeight:700,color:T.txt1,marginBottom:10}}>+ Agregar Pallet</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              <FormField label="N° TAG *"><Input value={newP.tag} onChange={v=>setNewP({...newP,tag:v})} placeholder="323"/></FormField>
              <FormField label="Lote *"><Input value={newP.lote} onChange={v=>setNewP({...newP,lote:v})} placeholder="AM26004RB"/></FormField>
              <FormField label="Presentación">
                <Select value={newP.presentacion} onChange={v=>{const kg=calcKgNeto(v,newP.cajas);setNewP({...newP,presentacion:v,kg_neto:kg});}} options={PRESENTACIONES}/>
              </FormField>
              <FormField label="Label"><Select value={newP.label} onChange={v=>setNewP({...newP,label:v})} options={LABELS}/></FormField>
              <FormField label="Calibre"><Select value={newP.calibre} onChange={v=>setNewP({...newP,calibre:v})} options={CALIBRES}/></FormField>
              <FormField label="Fecha"><Input type="date" value={newP.fecha} onChange={v=>setNewP({...newP,fecha:v})}/></FormField>
              <FormField label="Cajas/Pallet">
                <Input type="number" value={newP.cajas} onChange={v=>{const kg=calcKgNeto(newP.presentacion,v);setNewP({...newP,cajas:v,kg_neto:kg});}}/>
              </FormField>
              <FormField label="KG Neto (auto)">
                <div style={{...S.input,background:T.bg,color:T.amber,fontWeight:700,cursor:"default",display:"flex",alignItems:"center"}}>
                  {newP.kg_neto||calcKgNeto(newP.presentacion,newP.cajas)||"—"}
                </div>
              </FormField>
            </div>
            <button onClick={addPalletLocal} style={{...S.btn(T.teal),marginTop:6,fontSize:11}}>+ Agregar a la lista</button>
          </div>

          {/* Lista de pallets */}
          {pallets.length>0&&(
            <div style={{overflowX:"auto",borderRadius:8,border:`1px solid ${T.border}`}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:T.surface}}>
                  {["TAG","Lote","Present.","Label","Calibre","Fecha","Cajas","KG",""].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:T.txt3,fontWeight:700,fontSize:9,textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>{pallets.map(p=>(
                  <tr key={p.id} style={{borderBottom:`1px solid ${T.border}30`}}>
                    <td style={{padding:"6px 10px",fontFamily:T.mono,color:T.teal,fontWeight:700}}>{p.tag}</td>
                    <td style={{padding:"6px 10px",fontFamily:T.mono,color:T.purple}}>{p.lote}</td>
                    <td style={{padding:"6px 10px",color:T.txt1}}>{p.presentacion}</td>
                    <td style={{padding:"6px 10px",color:T.txt2}}>{p.label}</td>
                    <td style={{padding:"6px 10px",color:T.green}}>{p.calibre}</td>
                    <td style={{padding:"6px 10px",color:T.txt2}}>{p.fecha||"—"}</td>
                    <td style={{padding:"6px 10px",color:T.txt1,textAlign:"right"}}>{p.cajas}</td>
                    <td style={{padding:"6px 10px",color:T.amber,textAlign:"right"}}>{p.kg_neto}</td>
                    <td style={{padding:"6px 10px"}}><button onClick={()=>removePalletLocal(p.id)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14}}>🗑</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {pallets.length===0&&(
            <div style={{textAlign:"center",padding:"24px",color:T.txt3,fontSize:12,border:`1px dashed ${T.border}`,borderRadius:8}}>
              Sin pallets — agrega al menos uno antes de continuar
            </div>
          )}
        </div>
      )}

      {step===4&&(
        <div>
          <div style={{background:T.surface,borderRadius:10,padding:16,border:`1px solid ${T.border}`,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:T.txt3,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Resumen de cambios</div>
            {[
              {l:"Embarque",v:data.codigo},
              {l:"Fecha salida",v:data.fecha_salida},
              {l:"Hora",v:data.hora_salida},
              {l:"Tracto placa",v:data.tracto_placa},
              {l:"Remolque placa",v:data.remolque_placa},
              {l:"Thermo",v:data.thermo},
              {l:"Operador",v:data.operador},
              {l:"Sello",v:data.sello},
            ].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${T.border}30`,padding:"5px 0",fontSize:12}}>
                <span style={{color:T.txt3}}>{r.l}</span>
                <span style={{color:T.txt1,fontWeight:600}}>{r.v||"—"}</span>
              </div>
            ))}
            {dests.map((d,i)=>(
              <div key={i} style={{marginTop:10}}>
                <div style={{fontSize:11,color:T.teal,fontWeight:700,marginBottom:4}}>Destino {i+1}: {d.cliente||"—"}</div>
              </div>
            ))}
          </div>
          <div style={{background:T.amber+"10",border:`1px solid ${T.amber}30`,borderRadius:10,padding:12}}>
            <p style={{margin:0,fontSize:12,color:T.amber}}>⚠️ La edición del embarque requiere autorización del administrador. Se enviará una solicitud al admin y los cambios se aplicarán una vez aprobada.</p>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
        <button onClick={step===1?onClose:()=>setStep(s=>s-1)} style={S.btn(T.txt3)}>{step===1?"Cancelar":"← Atrás"}</button>
        {step<4
          ?<button onClick={()=>setStep(s=>s+1)} style={S.btnPrimary}>Siguiente →</button>
          :<button onClick={handleConfirmar} disabled={saving} style={{...S.btnPrimary,background:T.amber,color:"#1a0f00",opacity:saving?0.5:1}}>
            {saving?"Guardando…":"📤 Solicitar edición"}
          </button>
        }
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
export default function ExportacionApp(){
  // ── Permisos (Fase 8) ───────────────────────────────────────────────────────
  const { canView, canExecute } = usePermissionsForJSX();

  const [view,setView]              =useState("dashboard");
  const [embarques,setEmbarques]    =useState([]);
  const [loading,  setLoading]      =useState(true);
  const [selected,setSelected]      =useState(null);
  const [showWizard,setShowWizard]  =useState(false);
  const [showPacking,setShowPacking]=useState(false);
  const [destinos,setDestinos]      =useState(initialDestinos);
  const [contactos,setContactos]    =useState(initialContactos);
  /**
   * approvalModal — estado del modal de autorización activo.
   * null = cerrado
   * { action_key, context_id, context_data, title, description, onApproved } = abierto
   */
  const [approvalModal,setApprovalModal] =useState(null);

  // ── Cargar datos desde Supabase ───────────────────────────
  const loadAll = useCallback(async (silent=false)=>{
    if(!silent) setLoading(true);
    try{
      const {data:embData}=await supabase
        .from("embarques")
        .select(`*, destinos:embarque_destinos(*), pallets:embarque_pallets(*), documentos:embarque_documentos(*), correos:embarque_correos(*), tracking:embarque_tracking(*)`)
        .order("created_at",{ascending:false});
      if(embData) setEmbarques(embData.map(dbToEmbarque));

      const {data:destData}=await supabase.from("catalogos_destino").select("*").eq("activo",true).order("nombre");
      if(destData&&destData.length>0) setDestinos(destData.map(d=>({
        id:d.id,nombre:d.nombre,direccion:d.direccion||"",ciudad:d.ciudad||"",
        estado:d.estado||"",cp:d.codigo_postal||"",telefono:d.telefono||"",
        tax_id:d.tax_id||"",email:d.email||"",
      })));

      const {data:contData}=await supabase.from("contactos_exportacion").select("*").eq("activo",true).order("nombre");
      if(contData&&contData.length>0) setContactos(contData.map(c=>({
        id:c.id,nombre:c.nombre,empresa:c.empresa||"",
        rol:c.rol,email:c.email,es_fijo:c.es_fijo,activo:c.activo,
      })));
    }catch(e){ console.error("Error loading data:",e); }
    finally{ if(!silent) setLoading(false); }
  },[]);

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(()=>{ loadAll(); },[loadAll]);

  // ── Supabase Realtime — sincronización entre usuarios ─────
  // Escucha INSERT/UPDATE/DELETE en la tabla embarques para que
  // cambios de otros usuarios aparezcan sin recargar la página.
  useEffect(()=>{
    const channel = supabase
      .channel("embarques_realtime")
      .on("postgres_changes",
        { event:"INSERT", schema:"public", table:"embarques" },
        async (payload)=>{
          // Otro usuario creó un embarque: traer versión completa con joins
          const full = await fetchEmbarqueCompleto(payload.new.id);
          if(full) setEmbarques(prev=>{
            // Evitar duplicados si lo creamos nosotros mismos
            if(prev.find(e=>e.id===full.id)) return prev;
            return [full,...prev];
          });
        }
      )
      .on("postgres_changes",
        { event:"UPDATE", schema:"public", table:"embarques" },
        async (payload)=>{
          // Otro usuario movió/editó un embarque
          const full = await fetchEmbarqueCompleto(payload.new.id);
          if(!full) return;
          setEmbarques(prev=>prev.map(e=>e.id===full.id?full:e));
          setSelected(prev=>prev?.id===full.id?full:prev);
        }
      )
      .on("postgres_changes",
        { event:"DELETE", schema:"public", table:"embarques" },
        (payload)=>{
          setEmbarques(prev=>prev.filter(e=>e.id!==payload.old.id));
          setSelected(prev=>prev?.id===payload.old.id?null:prev);
        }
      )
      .subscribe();

    return ()=>{ supabase.removeChannel(channel); };
  },[]);

  const updateEmbarque=updated=>{
    setEmbarques(prev=>prev.map(e=>e.id===updated.id?updated:e));
    if(selected?.id===updated.id) setSelected(updated);
  };
  const addEmbarque=e=>setEmbarques(prev=>{
    // Evitar duplicado si Realtime ya lo agregó antes
    if(prev.find(x=>x.id===e.id)) return prev;
    return [e,...prev];
  });
  const selectEmbarque=e=>{setSelected(e);setView("detalle");};
  const [refreshing,setRefreshing]=useState(false);
  const handleManualRefresh=async()=>{
    setRefreshing(true);
    await loadAll(true);
    setRefreshing(false);
  };

  // Guardar/actualizar destino en DB y lista local
  const handleUpdateDestinos=async(newList)=>{
    // ── Fase 8: interceptar escrituras destructivas (edit/delete) ─────────────
    const isDelete = newList.length < destinos.length;
    const isEdit   = newList.length === destinos.length;
    if(isDelete || isEdit){
      const result = canExecute("exportacion.catalogos.edit");
      if(result === "needs_approval"){
        setApprovalModal({
          action_key:   "exportacion.catalogos.edit",
          context_data: { tipo: isDelete ? "Eliminar destino" : "Editar destino" },
          title:        isDelete ? "Eliminar destino del catálogo" : "Editar destino del catálogo",
          description:  "Los cambios en catálogos de exportación requieren autorización del administrador.",
          onApproved: () => _doUpdateDestinos(newList),
        });
        return; // pausar hasta que el admin apruebe
      }
    }
    await _doUpdateDestinos(newList);
  };

  const _doUpdateDestinos=async(newList)=>{
    // Detectar si es edición (mismo tamaño, un elemento cambió) o add/delete
    if(newList.length===destinos.length){
      // Edición: buscar el elemento modificado
      const changed=newList.find(d=>{ const old=destinos.find(x=>x.id===d.id); return old&&JSON.stringify(old)!==JSON.stringify(d); });
      if(changed){
        await supabase.from("catalogos_destino").update({
          nombre:changed.nombre,direccion:changed.direccion,ciudad:changed.ciudad,
          estado:changed.estado,codigo_postal:changed.cp,
          telefono:changed.telefono,tax_id:changed.tax_id,email:changed.email,
        }).eq("id",changed.id);
      }
    } else if(newList.length>destinos.length){
      // Inserción — sin guard (crear es libre)
      const added=newList.find(d=>!destinos.find(x=>x.id===d.id));
      if(added){
        const {data}=await supabase.from("catalogos_destino").insert({
          nombre:added.nombre,direccion:added.direccion,ciudad:added.ciudad,
          estado:added.estado,codigo_postal:added.cp,
          telefono:added.telefono,tax_id:added.tax_id,email:added.email,
        }).select().single();
        if(data) newList=newList.map(d=>d.id===added.id?{...d,id:data.id}:d);
      }
    } else {
      // Eliminación
      const removed=destinos.find(d=>!newList.find(x=>x.id===d.id));
      if(removed) await supabase.from("catalogos_destino").delete().eq("id",removed.id);
    }
    setDestinos(newList);
  };

  // Guardar/actualizar contacto en DB y lista local
  const handleUpdateContactos=async(newList)=>{
    // ── Fase 8: interceptar escrituras destructivas ───────────────────────────
    const isDelete = newList.length < contactos.length;
    const isEdit   = newList.length === contactos.length;
    if(isDelete || isEdit){
      const result = canExecute("exportacion.catalogos.edit");
      if(result === "needs_approval"){
        setApprovalModal({
          action_key:   "exportacion.catalogos.edit",
          context_data: { tipo: isDelete ? "Eliminar contacto" : "Editar contacto" },
          title:        isDelete ? "Eliminar contacto del catálogo" : "Editar contacto del catálogo",
          description:  "Los cambios en catálogos de exportación requieren autorización del administrador.",
          onApproved: () => _doUpdateContactos(newList),
        });
        return;
      }
    }
    await _doUpdateContactos(newList);
  };

  const _doUpdateContactos=async(newList)=>{
    if(newList.length===contactos.length){
      const changed=newList.find(c=>{ const old=contactos.find(x=>x.id===c.id); return old&&JSON.stringify(old)!==JSON.stringify(c); });
      if(changed){
        await supabase.from("contactos_exportacion").update({
          nombre:changed.nombre,empresa:changed.empresa,
          rol:changed.rol,email:changed.email,es_fijo:changed.es_fijo,
        }).eq("id",changed.id);
      }
    } else if(newList.length>contactos.length){
      const added=newList.find(c=>!contactos.find(x=>x.id===c.id));
      if(added){
        const {data}=await supabase.from("contactos_exportacion").insert({
          nombre:added.nombre,empresa:added.empresa,
          rol:added.rol,email:added.email,es_fijo:added.es_fijo,
        }).select().single();
        if(data) newList=newList.map(c=>c.id===added.id?{...c,id:data.id}:c);
      }
    } else {
      const removed=contactos.find(c=>!newList.find(x=>x.id===c.id));
      if(removed) await supabase.from("contactos_exportacion").delete().eq("id",removed.id);
    }
    setContactos(newList);
  };

  // ── Fase 8: NAV filtrada por permisos ────────────────────────────────────────
  const NAV=[
    {id:"dashboard", icon:"📊", label:"Dashboard",  navKey:"exportacion.dashboard"},
    {id:"kanban",    icon:"⬛", label:"Pipeline",   navKey:"exportacion.pipeline"},
    {id:"catalogos", icon:"🗂",  label:"Catálogos",  navKey:"exportacion.catalogos"},
  ].filter(n=>canView(n.navKey));

  const BREADCRUMBS={
    dashboard:"Dashboard",
    kanban:"Pipeline",
    detalle: selected?.codigo||"Embarque",
    catalogos:"Catálogos",
  };

  if(loading) return(
    <div style={{display:"flex",height:"100vh",background:T.bg,alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:40}}>🫐</div>
      <div style={{width:40,height:40,border:`3px solid ${T.border}`,borderTopColor:T.teal,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{fontSize:13,color:T.txt3}}>Cargando embarques…</div>
    </div>
  );

  return(
    <div style={{display:"flex",height:"100vh",background:T.bg,color:T.txt1,fontFamily:"'Segoe UI','IBM Plex Sans',system-ui,sans-serif",overflow:"hidden"}}>
      <style>{GLOBAL_CSS}</style>

      {/* Sidebar */}
      <div style={{width:64,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 0",gap:4,flexShrink:0}}>
        {/* Logo */}
        <div style={{width:40,height:40,borderRadius:12,background:T.teal+"20",border:`2px solid ${T.teal}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:12}}>🫐</div>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setView(n.id)} title={n.label}
            style={{width:44,height:44,borderRadius:10,background:view===n.id?T.teal+"20":"transparent",border:`1px solid ${view===n.id?T.teal+"50":"transparent"}`,color:view===n.id?T.teal:T.txt3,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
            {n.icon}
          </button>
        ))}
        {/* Separator */}
        <div style={{width:32,height:1,background:T.border,margin:"8px 0"}}/>
        {/* Quick-access: new embarque */}
        <button onClick={()=>setShowWizard(true)} title="Nuevo Embarque"
          style={{width:44,height:44,borderRadius:10,background:"transparent",border:`1px solid transparent`,color:T.txt3,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}
          onMouseEnter={el=>{el.currentTarget.style.background=T.green+"15";el.currentTarget.style.color=T.green;}}
          onMouseLeave={el=>{el.currentTarget.style.background="transparent";el.currentTarget.style.color=T.txt3;}}>
          ➕
        </button>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Breadcrumb bar */}
        <div style={{padding:"7px 16px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:T.txt3,display:"flex",alignItems:"center",gap:6,flexShrink:0,background:T.surface}}>
          <span>🏭 Operación</span><span>›</span><span style={{color:T.teal}}>Exportación</span>
          {view!=="kanban"&&<><span>›</span><span style={{color:T.txt2}}>{BREADCRUMBS[view]||view}</span></>}
          {/* Packing List button — only visible in detalle */}
          {view==="detalle"&&selected&&(
            <button onClick={()=>setShowPacking(true)}
              style={{...S.btn(T.blue),marginLeft:"auto",padding:"4px 12px",fontSize:10}}>
              📦 Packing List
            </button>
          )}
        </div>

        {/* Views — Fase 8: cada vista verifica canView */}
        <div style={{flex:1,overflow:"hidden"}}>
          {view==="dashboard"&&canView("exportacion.dashboard")&&(
            <DashboardView
              embarques={embarques}
              onSelectEmbarque={e=>{setSelected(e);setView("detalle");}}
            />
          )}
          {view==="kanban"&&canView("exportacion.pipeline")&&(
            <KanbanView embarques={embarques} onSelect={selectEmbarque} onNuevo={()=>setShowWizard(true)} onRefresh={handleManualRefresh} refreshing={refreshing}/>
          )}
          {view==="detalle"&&selected&&canView("exportacion.pipeline")&&(
            <DetalleEmbarque
              embarque={selected}
              onBack={()=>setView("kanban")}
              onUpdate={updateEmbarque}
              contactos={contactos}
              onRequestApproval={setApprovalModal}
              catalogoDestinos={destinos}
            />
          )}
          {view==="catalogos"&&canView("exportacion.catalogos")&&(
            <CatalogosView destinos={destinos} contactos={contactos} onUpdateDestinos={handleUpdateDestinos} onUpdateContactos={handleUpdateContactos}/>
          )}
          {/* Vista sin acceso */}
          {!canView("exportacion."+view)&&view!=="detalle"&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12,color:T.txt3}}>
              <span style={{fontSize:36}}>🔒</span>
              <span style={{fontSize:13}}>Sin acceso a esta sección</span>
            </div>
          )}
        </div>
      </div>

      {/* Wizard */}
      {showWizard&&<WizardNuevoEmbarque onClose={()=>setShowWizard(false)} onCreate={addEmbarque} catalogoDestinos={destinos}/>}

      {/* Packing List */}
      {showPacking&&selected&&<PackingListModal embarque={selected} onClose={()=>setShowPacking(false)}/>}

      {/* ── Fase 8: Modal de autorización (compartido entre todas las vistas) ── */}
      {approvalModal&&(
        <ApprovalRequestModalJSX
          action_key={approvalModal.action_key}
          context_id={approvalModal.context_id}
          context_data={approvalModal.context_data}
          title={approvalModal.title}
          description={approvalModal.description}
          onClose={()=>setApprovalModal(null)}
          onApproved={()=>{
            setApprovalModal(null);
            approvalModal.onApproved?.();
          }}
          onRequested={()=>setApprovalModal(null)}
        />
      )}
    </div>
  );
}