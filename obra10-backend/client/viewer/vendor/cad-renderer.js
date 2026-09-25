// vendor-research/cad-viewer/dist/cad-viewer.es.js
var Mr = Object.defineProperty;
var Tr = (t, e, n) => e in t ? Mr(t, e, { enumerable: true, configurable: true, writable: true, value: n }) : t[e] = n;
var S = (t, e, n) => Tr(t, typeof e != "symbol" ? e + "" : e, n);
function pn(t) {
  var e, n, s, i, o, r, a;
  return {
    format: t.format,
    sourceName: t.sourceName,
    units: t.units,
    header: (e = t.header) != null ? e : {},
    layers: (n = t.layers) != null ? n : {},
    lineTypes: (s = t.lineTypes) != null ? s : {},
    blocks: (i = t.blocks) != null ? i : {},
    entities: (o = t.entities) != null ? o : [],
    pages: t.pages,
    savedView: t.savedView,
    dataLinks: t.dataLinks,
    dataTables: t.dataTables,
    xrecords: t.xrecords,
    dictionaries: t.dictionaries,
    metadata: (r = t.metadata) != null ? r : {},
    warnings: (a = t.warnings) != null ? a : [],
    raw: t.raw
  };
}
function ot(t) {
  switch (String(t != null ? t : "").toUpperCase()) {
    case "LINE":
      return "line";
    case "CIRCLE":
      return "circle";
    case "ARC":
      return "arc";
    case "LWPOLYLINE":
    case "POLYLINE":
    case "POLYLINE_2D":
    case "POLYLINE2D":
    case "POLYLINE_3D":
    case "POLYLINE3D":
    case "LEADER":
    case "MULTILEADER":
      return "polyline";
    case "ELLIPSE":
      return "ellipse";
    case "TEXT":
    case "MTEXT":
    case "ATTRIB":
    case "ATTDEF":
    case "DIMENSION":
      return "text";
    case "POINT":
      return "point";
    case "INSERT":
    case "MINSERT":
      return "insert";
    case "SOLID":
    case "TRACE":
    case "3DFACE":
      return "solid";
    case "HATCH":
      return "hatch";
    case "SPLINE":
      return "spline";
    case "PATH":
    case "XPS_PATH":
    case "DWF_PATH":
      return "path";
    case "IMAGE":
    case "RASTER_IMAGE":
    case "DWF_IMAGE":
      return "image";
    case "VIEWPORT":
      return "viewport";
    case "TABLE":
    case "ACAD_TABLE":
    case "ACDBTABLE":
      return "table";
    default:
      return "unsupported";
  }
}
function ut(t, e, n = {}) {
  var v, x, w, C, N, B, D, I, P, M, T, A, F, _, X, R, O, W, H, G, Q, se, he, pe, ge, be, ye, xe, ve, we, Ce, Ve, je, Ge, qe, Ke, ce, ue, Ne, Mn, Tn, An, En, Ln, In, Dn, Bn, Rn, Fn, On, _n, $n, Xn, Wn, Un, zn, Yn, Hn, Vn, jn, Gn, qn, Kn, Zn, Jn, Qn, es, ts, ns, ss, is, os, rs, as, cs, ls, hs, us, fs, ds, ms, ps, gs, bs, ys, xs, vs, ws, Cs, Ss, ks, Ns, Ps, Ms, Ts, As, Es, Ls, Is, Ds, Bs, Rs, Fs, Os, _s, $s, Xs, Ws, Us, zs, Ys, Hs, Vs, js, Gs, qs, Ks, Zs, Js, Qs, ei, ti, ni, si, ii, oi, ri, ai, ci, li, hi, ui, fi, di, mi, pi, gi, bi, yi, xi, vi, wi, Ci, Si, ki, Ni, Pi, Mi, Ti, Ai, Ei, Li, Ii, Di, Bi;
  const s = e != null ? e : String((w = (x = (v = t.type) != null ? v : t.entityType) != null ? x : t.objectName) != null ? w : "UNKNOWN").toUpperCase(), i = n.includeUnknownProperties === false ? { type: s, kind: ot(s) } : { ...t, type: s, kind: ot(s) };
  n.keepRaw && (i.raw = t), i.handle = E((C = t.handle) != null ? C : t.id), i.layer = E((N = t.layer) != null ? N : t.layerName), i.lineType = E((B = t.lineType) != null ? B : t.linetype), i.lineTypeScale = (P = k((I = (D = t.lineTypeScale) != null ? D : t.linetypeScale) != null ? I : t.ltscale)) != null ? P : i.lineTypeScale, i.flag = (T = k((M = t.flag) != null ? M : t.flags)) != null ? T : i.flag, i.constantWidth = (_ = k((F = (A = t.constantWidth) != null ? A : t.constWidth) != null ? F : t.const_width)) != null ? _ : i.constantWidth, i.thickness = (X = k(t.thickness)) != null ? X : i.thickness;
  const o = t.isClosed === true || t.closed === true || t.shape === true, r = /^(POLYLINE|POLYLINE_2D|POLYLINE2D|POLYLINE_3D|POLYLINE3D|SPLINE)$/.test(s), a = s === "LWPOLYLINE";
  (o || r && (Number((R = i.flag) != null ? R : 0) & 1) === 1 || a && (Number((O = i.flag) != null ? O : 0) & 512) === 512) && (i.isClosed = true);
  const c = (W = n.numericColorMode) != null ? W : "auto", l = k(t.color), h = k((se = (Q = (G = (H = t.colorIndex) != null ? H : t.colorNumber) != null ? G : t.aci) != null ? Q : t.aciColor) != null ? se : t.color_index);
  i.colorIndex = h != null ? h : c !== "rgb" && l !== void 0 && Math.abs(l) <= 257 ? l : void 0;
  const u = (xe = (ye = (be = (ge = (pe = (he = t.trueColor) != null ? he : t.true_color) != null ? pe : t.truecolor) != null ? ge : t.colorRGB) != null ? be : t.colorRgb) != null ? ye : t.rgbColor) != null ? xe : t.rgb, f = l !== void 0 && l >= 0 && l <= 16777215 && (c === "rgb" || c === "auto" && Math.abs(l) > 257);
  i.trueColor = u != null ? u : f ? l : void 0, (typeof t.color == "string" || typeof t.color == "number") && (i.color = t.color), i.colorNumber = (ve = k(t.colorNumber)) != null ? ve : i.colorNumber, i.colorName = (Ce = E((we = t.colorName) != null ? we : t.color_name)) != null ? Ce : i.colorName, i.fillColor = (Ve = t.fillColor) != null ? Ve : t.fill_color, i.fillColorIndex = (qe = k((Ge = (je = t.fillColorIndex) != null ? je : t.fill_color_index) != null ? Ge : t.fillColorNumber)) != null ? qe : i.fillColorIndex, i.opacity = (ce = k((Ke = t.opacity) != null ? Ke : t.alpha)) != null ? ce : i.opacity, i.lineweight = k((ue = t.lineweight) != null ? ue : t.lineWeight), i.isVisible = !(t.isVisible === false || t.visible === false);
  const d = ie(t.text);
  i.startPoint = (En = V((An = (Tn = (Mn = (Ne = t.startPoint) != null ? Ne : d == null ? void 0 : d.startPoint) != null ? Mn : t.start) != null ? Tn : t.p0) != null ? An : t.from)) != null ? En : i.startPoint, i.endPoint = (Rn = V((Bn = (Dn = (In = (Ln = t.endPoint) != null ? Ln : d == null ? void 0 : d.endPoint) != null ? In : t.end) != null ? Dn : t.p1) != null ? Bn : t.to)) != null ? Rn : i.endPoint, i.center = (On = V((Fn = t.center) != null ? Fn : t.centerPoint)) != null ? On : i.center, i.insertionPoint = (zn = V((Un = (Wn = (Xn = ($n = (_n = t.insertionPoint) != null ? _n : d == null ? void 0 : d.startPoint) != null ? $n : t.position) != null ? Xn : t.location) != null ? Wn : t.point) != null ? Un : t.basePoint)) != null ? zn : i.insertionPoint, i.radius = (Yn = k(t.radius)) != null ? Yn : i.radius, i.startAngle = (Vn = k((Hn = t.startAngle) != null ? Hn : t.start_angle)) != null ? Vn : i.startAngle, i.endAngle = (Gn = k((jn = t.endAngle) != null ? jn : t.end_angle)) != null ? Gn : i.endAngle, i.majorAxisEndPoint = (Zn = V((Kn = (qn = t.majorAxisEndPoint) != null ? qn : t.majorAxis) != null ? Kn : t.major)) != null ? Zn : i.majorAxisEndPoint, i.axisRatio = (Qn = k((Jn = t.axisRatio) != null ? Jn : t.ratio)) != null ? Qn : i.axisRatio, i.height = (ns = k((ts = (es = t.height) != null ? es : t.textHeight) != null ? ts : d == null ? void 0 : d.textHeight)) != null ? ns : i.height, i.textHeight = (os = k((is = (ss = t.textHeight) != null ? ss : t.height) != null ? is : d == null ? void 0 : d.textHeight)) != null ? os : i.textHeight, i.xScale = (cs = k((as = (rs = t.xScale) != null ? rs : t.widthFactor) != null ? as : d == null ? void 0 : d.xScale)) != null ? cs : i.xScale, i.generationFlag = (us = k((hs = (ls = t.generationFlag) != null ? ls : t.textGenerationFlag) != null ? hs : d == null ? void 0 : d.generationFlag)) != null ? us : i.generationFlag, i.halign = (ms = k((ds = (fs = t.halign) != null ? fs : t.horizontalAlignment) != null ? ds : d == null ? void 0 : d.halign)) != null ? ms : i.halign, i.valign = (bs = k((gs = (ps = t.valign) != null ? ps : t.verticalAlignment) != null ? gs : d == null ? void 0 : d.valign)) != null ? bs : i.valign, i.extrusionDirection = (vs = V((xs = (ys = t.extrusionDirection) != null ? ys : t.extrusion) != null ? xs : d == null ? void 0 : d.extrusionDirection)) != null ? vs : i.extrusionDirection, i.rotation = (Ss = k((Cs = (ws = t.rotation) != null ? ws : t.angle) != null ? Cs : d == null ? void 0 : d.rotation)) != null ? Ss : i.rotation, i.text = (Es = E((As = (Ts = (Ms = (Ps = (Ns = (ks = d == null ? void 0 : d.text) != null ? ks : t.text) != null ? Ns : t.value) != null ? Ps : t.string) != null ? Ms : t.contents) != null ? Ts : t.defaultValue) != null ? As : t.default_value)) != null ? Es : i.text, i.value = (Os = E((Fs = (Rs = (Bs = (Ds = (Is = (Ls = t.value) != null ? Ls : d == null ? void 0 : d.text) != null ? Is : t.text) != null ? Ds : t.string) != null ? Bs : t.contents) != null ? Rs : t.defaultValue) != null ? Fs : t.default_value)) != null ? Os : i.value, i.name = ($s = E((_s = t.name) != null ? _s : t.blockName)) != null ? $s : i.name, i.blockName = (Ws = E((Xs = t.blockName) != null ? Xs : t.name)) != null ? Ws : i.blockName, i.effectiveBlockName = (Hs = E((Ys = (zs = (Us = t.effectiveBlockName) != null ? Us : t.effectiveName) != null ? zs : t.dynamicBlockName) != null ? Ys : t.originalBlockName)) != null ? Hs : i.effectiveBlockName, i.extensionDictionaryHandle = (qs = rt((Gs = (js = (Vs = t.extensionDictionaryHandle) != null ? Vs : t.ownerDictionaryHardId) != null ? js : t.ownerdictionaryHardId) != null ? Gs : t.xdicobjhandle)) != null ? qs : i.extensionDictionaryHandle, i.ownerBlockRecordHandle = (Js = rt((Zs = (Ks = t.ownerBlockRecordHandle) != null ? Ks : t.ownerBlockRecordSoftId) != null ? Zs : t.ownerHandle)) != null ? Js : i.ownerBlockRecordHandle, i.attributeTag = (ni = E((ti = (ei = (Qs = t.attributeTag) != null ? Qs : t.tag) != null ? ei : t.tagString) != null ? ti : t.attrTag)) != null ? ni : i.attributeTag, i.attributePrompt = (oi = E((ii = (si = t.attributePrompt) != null ? si : t.prompt) != null ? ii : t.promptString)) != null ? oi : i.attributePrompt, i.attributeFlags = (ci = k((ai = (ri = t.attributeFlags) != null ? ri : t.flags) != null ? ai : t.flag)) != null ? ci : i.attributeFlags, (s === "INSERT" || s === "MINSERT") && (i.insertRowCount = (fi = Se((ui = (hi = (li = t.insertRowCount) != null ? li : t.rowCount) != null ? hi : t.numRows) != null ? ui : t.num_rows)) != null ? fi : i.insertRowCount, i.insertColumnCount = (bi = Se((gi = (pi = (mi = (di = t.insertColumnCount) != null ? di : t.columnCount) != null ? mi : t.numColumns) != null ? pi : t.numCols) != null ? gi : t.num_cols)) != null ? bi : i.insertColumnCount, i.insertRowSpacing = (vi = k((xi = (yi = t.insertRowSpacing) != null ? yi : t.rowSpacing) != null ? xi : t.row_spacing)) != null ? vi : i.insertRowSpacing, i.insertColumnSpacing = (Si = k((Ci = (wi = t.insertColumnSpacing) != null ? wi : t.columnSpacing) != null ? Ci : t.col_spacing)) != null ? Si : i.insertColumnSpacing);
  const m = Fo((Ni = (ki = t.xdata) != null ? ki : t.extendedData) != null ? Ni : t.xData);
  if (m.length > 0 && (i.xdata = m), s === "INSERT" || s === "MINSERT") {
    const Pe = V(t.scale);
    if (Pe)
      i.scale = Pe;
    else {
      const gt = k((Pi = t.scaleX) != null ? Pi : t.xScale), _t = (Ti = k((Mi = t.scaleY) != null ? Mi : t.yScale)) != null ? Ti : gt, Ri = k((Ai = t.scaleZ) != null ? Ai : t.zScale);
      gt !== void 0 && _t !== void 0 && (i.scale = Ri === void 0 ? { x: gt, y: _t } : { x: gt, y: _t, z: Ri });
    }
  }
  const p = $t((Ei = t.vertices) != null ? Ei : t.points);
  p.length > 0 && (i.vertices = p);
  const g = $t((Li = t.controlPoints) != null ? Li : t.control_points);
  g.length > 0 && (i.controlPoints = g);
  const b = $t((Ii = t.fitPoints) != null ? Ii : t.fit_points);
  b.length > 0 && (i.fitPoints = b);
  const y = (Bi = (Di = t.attribs) != null ? Di : t.attributes) != null ? Bi : t.attributeEntities;
  return Array.isArray(y) && (i.attribs = y.filter((Pe) => !!Pe && typeof Pe == "object").map((Pe) => ut(Pe, void 0, n))), (s === "TABLE" || s === "ACAD_TABLE" || s === "ACDBTABLE") && (i.table = Ur(t)), i;
}
function Ur(t) {
  var l, h, u, f, d, m, p, g, b, y, v, x, w, C, N, B, D, I, P, M, T, A, F, _, X, R, O, W, H, G, Q;
  const e = ie((l = t.ldata) != null ? l : t.linkedData), n = ie((h = t.tdata) != null ? h : t.linkedTableData), s = (g = Se((p = (m = (d = (f = (u = t.rowCount) != null ? u : t.rowsCount) != null ? f : t.numRows) != null ? d : t.num_rows) != null ? m : n == null ? void 0 : n.numRows) != null ? p : n == null ? void 0 : n.num_rows)) != null ? g : 0, i = (B = Se((N = (C = (w = (x = (v = (y = (b = t.columnCount) != null ? b : t.columnsCount) != null ? y : t.numColumns) != null ? v : t.numCols) != null ? x : t.num_cols) != null ? w : n == null ? void 0 : n.numColumns) != null ? C : n == null ? void 0 : n.numCols) != null ? N : n == null ? void 0 : n.num_cols)) != null ? B : 0, o = Bo((M = (P = (I = (D = t.cells) != null ? D : t.tableCells) != null ? I : t.cellValues) != null ? P : n == null ? void 0 : n.rows) != null ? M : t.data), r = i || Hr(o), a = s || (r > 0 ? Math.ceil(o.length / r) : 0), c = o.map(({ cell: se, index: he }) => Vr(se, he, r));
  return {
    name: E((F = (A = (T = t.tableName) != null ? T : t.name) != null ? A : e == null ? void 0 : e.name) != null ? F : e == null ? void 0 : e.description),
    rowCount: a,
    columnCount: r,
    cells: c,
    rowHeights: $i((X = (_ = t.rowHeights) != null ? _ : t.rowHeightArr) != null ? X : t.row_heights),
    columnWidths: $i((O = (R = t.columnWidths) != null ? R : t.columnWidthArr) != null ? O : t.col_widths),
    dataLinkHandle: rt((H = (W = t.dataLinkHandle) != null ? W : t.dataLink) != null ? H : t.data_link),
    titleSuppressed: At((G = t.titleSuppressed) != null ? G : t.title_suppressed),
    headerSuppressed: At((Q = t.headerSuppressed) != null ? Q : t.header_suppressed)
  };
}
function V(t) {
  var r, a, c, l, h, u;
  if (!t || typeof t != "object") return;
  const e = t, n = Number((a = (r = e.x) != null ? r : e.X) != null ? a : e[0]), s = Number((l = (c = e.y) != null ? c : e.Y) != null ? l : e[1]), i = (u = (h = e.z) != null ? h : e.Z) != null ? u : e[2], o = i === void 0 ? void 0 : Number(i);
  if (!(!Number.isFinite(n) || !Number.isFinite(s)))
    return Number.isFinite(o) ? { x: n, y: s, z: o } : { x: n, y: s };
}
function $t(t) {
  var n, s;
  if (!Array.isArray(t)) return [];
  const e = [];
  for (const i of t) {
    const o = V(i);
    if (!o) continue;
    const r = i, a = o, c = k(r.bulge);
    c !== void 0 && (a.bulge = c);
    const l = k((n = r.startWidth) != null ? n : r.start_width);
    l !== void 0 && (a.startWidth = l);
    const h = k((s = r.endWidth) != null ? s : r.end_width);
    h !== void 0 && (a.endWidth = h), e.push(a);
  }
  return e;
}
function Lo(t) {
  var l, h, u;
  if (t.isClosed === true) return true;
  const e = String((l = t.type) != null ? l : "").toUpperCase(), n = Number((h = t.flag) != null ? h : 0), s = e === "LWPOLYLINE", i = /^(POLYLINE|POLYLINE_2D|POLYLINE2D|POLYLINE_3D|POLYLINE3D)$/.test(e);
  if (s && (n & 512) === 512 || i && (n & 1) === 1) return true;
  if (!s && !i) return false;
  const o = (u = t.vertices) != null ? u : t.points;
  if (!Array.isArray(o) || o.length < 3) return false;
  const r = o[0], a = o[o.length - 1];
  if (!r || !a) return false;
  const c = o.reduce((f, d) => Math.max(f, Math.abs(d.x), Math.abs(d.y)), 1);
  return Math.hypot(r.x - a.x, r.y - a.y) <= Math.max(1e-9, c * 1e-12);
}
function Io(t) {
  var n;
  let e = Xt(t.constantWidth);
  for (const s of (n = t.vertices) != null ? n : [])
    e = Math.max(e, Xt(s.startWidth), Xt(s.endWidth));
  return e;
}
function Jt(t, e) {
  e.name && (t[e.name] = e, t[e.name.toLowerCase()] = e);
}
function Do(t, e) {
  e.name && (t[e.name] = e, t[e.name.toLowerCase()] = e);
}
function zr(t, e) {
  e.name && (t[e.name] = e, t[e.name.toLowerCase()] = e, e.handle && (t[e.handle] = e, t[e.handle.toLowerCase()] = e));
}
function k(t) {
  const e = Number(t);
  return Number.isFinite(e) ? e : void 0;
}
function E(t) {
  if (typeof t != "string" && typeof t != "number") return;
  const e = String(t);
  return e.length > 0 ? e : void 0;
}
function ie(t) {
  return t && typeof t == "object" && !Array.isArray(t) ? t : void 0;
}
function Se(t) {
  const e = k(t);
  if (!(e === void 0 || e <= 0))
    return Math.max(1, Math.trunc(e));
}
function At(t) {
  if (typeof t == "boolean") return t;
  if (t === 0 || t === "0") return false;
  if (t === 1 || t === "1") return true;
}
function $i(t) {
  if (!Array.isArray(t)) return;
  const e = t.map(k).filter((n) => n !== void 0);
  return e.length > 0 ? e : void 0;
}
function rt(t) {
  var e, n, s, i, o, r;
  if (Array.isArray(t))
    return E((n = (e = t[3]) != null ? e : t[2]) != null ? n : t[t.length - 1]);
  if (t && typeof t == "object") {
    const a = t;
    return E((r = (o = (i = (s = a.absolute_ref) != null ? s : a.absoluteRef) != null ? i : a.handle) != null ? o : a.id) != null ? r : a.value);
  }
  return E(t);
}
function Bo(t) {
  var s, i, o;
  if (!Array.isArray(t)) {
    const r = ie(t), a = (i = (s = r == null ? void 0 : r.rows) != null ? s : r == null ? void 0 : r.values) != null ? i : r == null ? void 0 : r.cells;
    return Array.isArray(a) ? Bo(a) : [];
  }
  const e = [];
  let n = 0;
  for (const r of t) {
    if (Array.isArray(r)) {
      for (const l of r) e.push({ cell: l, index: n++ });
      continue;
    }
    const a = ie(r), c = (o = a == null ? void 0 : a.cells) != null ? o : a == null ? void 0 : a.values;
    if (Array.isArray(c) && !("text" in (a != null ? a : {})) && !("value" in (a != null ? a : {}))) {
      for (const l of c) e.push({ cell: l, index: n++ });
      continue;
    }
    e.push({ cell: r, index: n++ });
  }
  return e;
}
function Hr(t) {
  var n, s, i;
  let e = -1;
  for (const { cell: o } of t) {
    const r = ie(o), a = k((i = (s = (n = r == null ? void 0 : r.column) != null ? n : r == null ? void 0 : r.columnIndex) != null ? s : r == null ? void 0 : r.col) != null ? i : r == null ? void 0 : r.column_index);
    a !== void 0 && (e = Math.max(e, Math.trunc(a)));
  }
  return e >= 0 ? e + 1 : 0;
}
function Vr(t, e, n) {
  var u, f, d, m, p, g, b, y, v, x, w, C, N, B, D, I, P, M, T, A, F, _, X, R, O, W, H, G, Q, se, he, pe, ge, be, ye, xe, ve, we, Ce;
  const s = ie(t), i = s ? jr(s) : me(t), o = E(s ? (p = (m = (d = (f = (u = s.text) != null ? u : s.textValue) != null ? f : s.text_value) != null ? d : s.valueString) != null ? m : s.value_string) != null ? p : s.displayValue : t), r = o != null ? o : Ro(i), a = Math.max(0, Math.trunc((y = k((b = (g = s == null ? void 0 : s.row) != null ? g : s == null ? void 0 : s.rowIndex) != null ? b : s == null ? void 0 : s.row_index)) != null ? y : n > 0 ? Math.floor(e / n) : e)), c = Math.max(0, Math.trunc((C = k((w = (x = (v = s == null ? void 0 : s.column) != null ? v : s == null ? void 0 : s.columnIndex) != null ? x : s == null ? void 0 : s.col) != null ? w : s == null ? void 0 : s.column_index)) != null ? C : n > 0 ? e % n : 0)), l = E((N = s == null ? void 0 : s.attrText) != null ? N : s == null ? void 0 : s.attributeText), h = l ? { value: l } : Gr((B = s == null ? void 0 : s.blockAttributes) != null ? B : s == null ? void 0 : s.attributes);
  return {
    row: a,
    column: c,
    text: r,
    ...i !== void 0 ? { value: i } : {},
    ...E((D = s == null ? void 0 : s.dataType) != null ? D : s == null ? void 0 : s.typeName) || k((I = s == null ? void 0 : s.cellType) != null ? I : s == null ? void 0 : s.type) !== void 0 ? { dataType: (T = E((P = s == null ? void 0 : s.dataType) != null ? P : s == null ? void 0 : s.typeName)) != null ? T : k((M = s == null ? void 0 : s.cellType) != null ? M : s == null ? void 0 : s.type) } : {},
    ...E((A = s == null ? void 0 : s.formula) != null ? A : s == null ? void 0 : s.expression) ? { formula: E((F = s == null ? void 0 : s.formula) != null ? F : s == null ? void 0 : s.expression) } : {},
    ...Se((X = (_ = s == null ? void 0 : s.rowSpan) != null ? _ : s == null ? void 0 : s.mergedHeight) != null ? X : s == null ? void 0 : s.merged_height_flag) ? { rowSpan: Se((O = (R = s == null ? void 0 : s.rowSpan) != null ? R : s == null ? void 0 : s.mergedHeight) != null ? O : s == null ? void 0 : s.merged_height_flag) } : {},
    ...Se((H = (W = s == null ? void 0 : s.columnSpan) != null ? W : s == null ? void 0 : s.mergedWidth) != null ? H : s == null ? void 0 : s.merged_width_flag) ? { columnSpan: Se((Q = (G = s == null ? void 0 : s.columnSpan) != null ? G : s == null ? void 0 : s.mergedWidth) != null ? Q : s == null ? void 0 : s.merged_width_flag) } : {},
    ...At((he = (se = s == null ? void 0 : s.isMerged) != null ? se : s == null ? void 0 : s.mergedValue) != null ? he : s == null ? void 0 : s.is_merged_value) !== void 0 ? { isMerged: At((ge = (pe = s == null ? void 0 : s.isMerged) != null ? pe : s == null ? void 0 : s.mergedValue) != null ? ge : s == null ? void 0 : s.is_merged_value) } : {},
    ...k((be = s == null ? void 0 : s.textHeight) != null ? be : s == null ? void 0 : s.text_height) !== void 0 ? { textHeight: k((ye = s == null ? void 0 : s.textHeight) != null ? ye : s == null ? void 0 : s.text_height) } : {},
    ...rt((ve = (xe = s == null ? void 0 : s.blockTableRecordId) != null ? xe : s == null ? void 0 : s.blockRecordHandle) != null ? ve : s == null ? void 0 : s.block_handle) ? { blockTableRecordId: rt((Ce = (we = s == null ? void 0 : s.blockTableRecordId) != null ? we : s == null ? void 0 : s.blockRecordHandle) != null ? Ce : s == null ? void 0 : s.block_handle) } : {},
    ...h && Object.keys(h).length > 0 ? { blockAttributes: h } : {}
  };
}
function jr(t) {
  const e = ie(t.value), n = [
    e == null ? void 0 : e.valueString,
    e == null ? void 0 : e.value_string,
    e == null ? void 0 : e.dataString,
    e == null ? void 0 : e.data_string,
    e == null ? void 0 : e.dataLong,
    e == null ? void 0 : e.data_long,
    e == null ? void 0 : e.dataDouble,
    e == null ? void 0 : e.data_double,
    e == null ? void 0 : e.dataDate,
    e == null ? void 0 : e.data_date,
    e == null ? void 0 : e.dataPoint,
    e == null ? void 0 : e.data_point,
    e == null ? void 0 : e.data3dPoint,
    e == null ? void 0 : e.data_3dpoint,
    t.rawValue,
    t.value
  ];
  for (const s of n) {
    const i = me(s);
    if (i !== void 0 && i !== "") return i;
  }
}
function Ro(t) {
  if (t == null) return "";
  if (typeof t == "string" || typeof t == "number" || typeof t == "boolean") return String(t);
  if (!Array.isArray(t) && typeof t == "object" && "x" in t && "y" in t) {
    const e = t;
    return [e.x, e.y, e.z].filter((n) => n !== void 0).join(", ");
  }
  try {
    return JSON.stringify(t);
  } catch (e) {
    return String(t);
  }
}
function Gr(t) {
  var s;
  const e = ie(t);
  if (!e) return;
  const n = {};
  for (const [i, o] of Object.entries(e)) {
    const r = (s = E(o)) != null ? s : Ro(me(o));
    r && (n[i] = r);
  }
  return Object.keys(n).length > 0 ? n : void 0;
}
function Fo(t) {
  var r, a, c, l, h, u;
  if (!t) return [];
  if (Array.isArray(t)) {
    if (t.some((d) => {
      var m, p;
      return ((m = ie(d)) == null ? void 0 : m.appName) !== void 0 || ((p = ie(d)) == null ? void 0 : p.applicationName) !== void 0;
    }))
      return t.flatMap((d) => Fo(d));
    const f = t.map(xt).filter((d) => !!d);
    return f.length > 0 ? [{ entries: f }] : [];
  }
  const e = ie(t);
  if (!e) return [];
  const n = E((a = (r = e.appName) != null ? r : e.applicationName) != null ? a : e.app), s = Array.isArray(e.customStrings) ? e.customStrings.map((f) => ({ code: 1e3, value: f })) : void 0, i = (u = (h = (l = (c = e.entries) != null ? c : e.value) != null ? l : e.values) != null ? h : e.data) != null ? u : s;
  if (Array.isArray(i)) {
    const f = i.map(xt).filter((d) => !!d);
    return f.length > 0 ? [{ appName: n, entries: f }] : [];
  }
  if (n) {
    const f = xt(i);
    return f ? [{ appName: n, entries: [f] }] : [];
  }
  const o = [];
  for (const [f, d] of Object.entries(e)) {
    const m = (Array.isArray(d) ? d : [d]).map(xt).filter((p) => !!p);
    m.length > 0 && o.push({ appName: f, entries: m });
  }
  return o;
}
function xt(t) {
  var s, i, o, r, a, c, l;
  const e = ie(t);
  if (e) {
    const h = me((o = (i = (s = e.value) != null ? s : e.data) != null ? i : e.text) != null ? o : e);
    return h === void 0 ? void 0 : {
      ...k((r = e.code) != null ? r : e.groupCode) !== void 0 ? { code: k((a = e.code) != null ? a : e.groupCode) } : {},
      ...E((c = e.name) != null ? c : e.key) ? { name: E((l = e.name) != null ? l : e.key) } : {},
      value: h
    };
  }
  const n = me(t);
  return n === void 0 ? void 0 : { value: n };
}
function me(t, e = 0, n = /* @__PURE__ */ new WeakSet()) {
  if (t === null) return null;
  if (typeof t == "string" || typeof t == "boolean") return t;
  if (typeof t == "number") return Number.isFinite(t) ? t : String(t);
  if (typeof t == "bigint") return t.toString();
  if (t instanceof Date) return t.toISOString();
  if (ArrayBuffer.isView(t)) return Array.from(new Uint8Array(t.buffer, t.byteOffset, Math.min(t.byteLength, 65536)));
  if (e >= 12 || !t || typeof t != "object") return;
  if (n.has(t)) return "[Circular]";
  if (n.add(t), Array.isArray(t)) {
    const i = t.slice(0, 1e5).map((o) => me(o, e + 1, n)).filter((o) => o !== void 0);
    return n.delete(t), i;
  }
  const s = {};
  for (const [i, o] of Object.entries(t).slice(0, 1e4)) {
    const r = me(o, e + 1, n);
    r !== void 0 && (s[i] = r);
  }
  return n.delete(t), s;
}
function Xt(t) {
  const e = Math.abs(Number(t));
  return Number.isFinite(e) ? e : 0;
}
function fe() {
  return { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 };
}
function ae(t) {
  return Number.isFinite(t.minX) && Number.isFinite(t.minY) && Number.isFinite(t.maxX) && Number.isFinite(t.maxY) && t.maxX >= t.minX && t.maxY >= t.minY;
}
function K(t, e) {
  L(e) && (t.minX = Math.min(t.minX, e.x), t.minY = Math.min(t.minY, e.y), t.maxX = Math.max(t.maxX, e.x), t.maxY = Math.max(t.maxY, e.y));
}
function qr(t, e, n) {
  if (!L(e) || !Number.isFinite(n)) return;
  const s = Math.abs(n);
  K(t, { x: e.x - s, y: e.y - s }), K(t, { x: e.x + s, y: e.y + s });
}
function Oo(t, e) {
  ae(e) && (K(t, { x: e.minX, y: e.minY }), K(t, { x: e.maxX, y: e.maxY }));
}
function _o(t, e = 0.02, n = 1e-6) {
  if (!ae(t)) return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  const s = Math.max((t.maxX - t.minX) * e, n), i = Math.max((t.maxY - t.minY) * e, n);
  return { minX: t.minX - s, minY: t.minY - i, maxX: t.maxX + s, maxY: t.maxY + i };
}
function L(t) {
  return !!t && typeof t == "object" && Number.isFinite(t.x) && Number.isFinite(t.y);
}
function j(t) {
  return { x: t.x, y: t.y };
}
function Le(t) {
  return t * Math.PI / 180;
}
function at(t, e, n, s, i = true, o = 64) {
  if (!L(t) || !Number.isFinite(e)) return [];
  let r = n, a = s;
  if (!Number.isFinite(r) || !Number.isFinite(a)) return [];
  (Math.abs(r) > Math.PI * 2 + 1e-6 || Math.abs(a) > Math.PI * 2 + 1e-6) && (r = Le(r), a = Le(a)), i && a < r && (a += Math.PI * 2), !i && r < a && (r += Math.PI * 2);
  const c = a - r, l = Math.max(8, Math.min(256, Math.ceil(Math.abs(c) / (Math.PI * 2) * o))), h = [];
  for (let u = 0; u <= l; u++) {
    const f = r + c * (u / l);
    h.push({ x: t.x + Math.cos(f) * e, y: t.y + Math.sin(f) * e });
  }
  return h;
}
function gn(t, e, n = 1, s = 0, i = Math.PI * 2, o = 96) {
  if (!L(t) || !L(e)) return [];
  const r = Math.hypot(e.x, e.y);
  if (!Number.isFinite(r) || r <= 0) return [];
  const a = r * (Number.isFinite(n) && n > 0 ? n : 1), c = Math.atan2(e.y, e.x);
  let l = Number.isFinite(s) ? s : 0, h = Number.isFinite(i) ? i : Math.PI * 2;
  (Math.abs(l) > Math.PI * 2 + 1e-6 || Math.abs(h) > Math.PI * 2 + 1e-6) && (l = Le(l), h = Le(h)), h < l && (h += Math.PI * 2);
  const u = Math.max(12, Math.min(256, Math.ceil(Math.abs(h - l) / (Math.PI * 2) * o))), f = [], d = Math.cos(c), m = Math.sin(c);
  for (let p = 0; p <= u; p++) {
    const g = l + (h - l) * (p / u), b = Math.cos(g) * r, y = Math.sin(g) * a;
    f.push({ x: t.x + b * d - y * m, y: t.y + b * m + y * d });
  }
  return f;
}
function $o(t, e, n = 0, s = 16) {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-12) return [j(t), j(e)];
  const i = Math.hypot(e.x - t.x, e.y - t.y);
  if (i <= 1e-12) return [j(t), j(e)];
  const o = 4 * Math.atan(n), r = Math.abs(i / (2 * Math.sin(o / 2))), a = { x: (t.x + e.x) / 2, y: (t.y + e.y) / 2 }, c = (e.x - t.x) / i, l = (e.y - t.y) / i, h = n >= 0 ? 1 : -1, u = Math.sqrt(Math.max(r * r - (i / 2) ** 2, 0)), f = { x: a.x - h * l * u, y: a.y + h * c * u }, d = Math.atan2(t.y - f.y, t.x - f.x), m = Math.atan2(e.y - f.y, e.x - f.x);
  return at(f, r, d, m, n >= 0, s);
}
function Xo(t) {
  return t.replace(/\\P/g, `
`).replace(/\\~|\\ /g, " ").replace(/\\[A-Za-z][^;]*;/g, "").replace(/[{}]/g, "").replace(/\\[A-Za-z]/g, "").trim();
}
function Re(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
var Xi = 128 * 1024 * 1024;
function yn(t) {
  const e = t[0];
  if (!e || !e.width || !e.height) throw new Error("CAD canvas is not ready for capture.");
  const n = e.ownerDocument.createElement("canvas");
  n.width = e.width, n.height = e.height;
  const s = n.getContext("2d");
  if (!s) throw new Error("Canvas 2D is required for CAD capture.");
  for (const i of t)
    s.drawImage(i, 0, 0, n.width, n.height);
  return n;
}
var Ko = [
  "block-attributes",
  "native-table",
  "data-table",
  "xdata",
  "xrecord",
  "text-table"
];
var nc = Ko.filter((t) => t !== "xdata" && t !== "xrecord");
var rn = "cadColorMode";
var Mt = "cadMonochromeColor";
function Sn(t) {
  const e = t == null ? void 0 : t.metadata, n = (e == null ? void 0 : e[rn]) === "monochrome" ? "monochrome" : "source", s = tr(e == null ? void 0 : e[Mt]);
  return s ? { mode: n, monochromeColor: s } : { mode: n };
}
function tr(t) {
  return typeof t != "string" ? void 0 : t.trim() || void 0;
}
var no = 0.2;
var Uc = class {
  /**
   * Whether the aligned glyph should store the resolved advance as explicit.
   * When false, {@link ShxShape.hasExplicitAdvance} is preserved from the source glyph.
   */
  markAlignedAdvanceExplicit(e) {
    return false;
  }
};
var Dt = class _Dt extends Uc {
  constructor(e = no) {
    super(), this.cellWidthFactor = e;
  }
  /**
   * True when ink extends left of the glyph origin (UNIFONT center-cell encoding).
   */
  static isCenterOriginGlyph(e) {
    return e.bbox.minX < -1e-6;
  }
  /**
   * Resolves ink-based advance for a glyph at a scaled cell width.
   *
   * Left-origin glyphs (`minX >= 0`): `maxX + cellWidth * factor`.
   * Center-origin glyphs (`minX < 0`): advance to the right cell edge
   * (`max(maxX, cellWidth / 2)`) plus padding, so narrow centered punctuation
   * keeps trailing whitespace instead of colliding with the next glyph.
   */
  static computeAdvance(e, n, s = no) {
    if (!e.polylines.some((r) => r.length >= 2))
      return n * s;
    const i = n * s, { maxX: o } = e.bbox;
    return _Dt.isCenterOriginGlyph(e) ? Math.max(o, n / 2) + i : o + i;
  }
  resolve(e, n) {
    var i;
    var s;
    return e.hasExplicitAdvance ? (i = (s = e.lastPoint) == null ? void 0 : s.x) != null ? i : 0 : _Dt.computeAdvance(e, n, this.cellWidthFactor);
  }
  markAlignedAdvanceExplicit(e) {
    return true;
  }
};
var mt = new Dt();
var ro = Math.PI / 4;
var nl = Math.PI / 18;
var ar = Object.freeze({
  resolveShape: () => {
  },
  resolveText: () => {
  }
});
var dl = {
  1: "#ff0000",
  2: "#ffff00",
  3: "#00ff00",
  4: "#00ffff",
  5: "#0000ff",
  6: "#ff00ff",
  8: "#808080",
  9: "#c0c0c0",
  10: "#ff0000",
  11: "#ff7f7f",
  12: "#a50000",
  13: "#a55252",
  14: "#7f0000",
  15: "#7f3f3f",
  16: "#4c0000",
  17: "#4c2626",
  18: "#260000",
  19: "#261313",
  20: "#ff3f00",
  21: "#ff9f7f",
  22: "#a52900",
  23: "#a56752",
  24: "#7f1f00",
  25: "#7f4f3f",
  26: "#4c1300",
  27: "#4c2f26",
  28: "#260900",
  29: "#261713",
  30: "#ff7f00",
  31: "#ffbf7f",
  32: "#a55200",
  33: "#a57c52",
  34: "#7f3f00",
  35: "#7f5f3f",
  36: "#4c2600",
  37: "#4c3926",
  38: "#261300",
  39: "#261c13",
  40: "#ffbf00",
  41: "#ffdf7f",
  42: "#a57c00",
  43: "#a59152",
  44: "#7f5f00",
  45: "#7f6f3f",
  46: "#4c3900",
  47: "#4c4226",
  48: "#261c00",
  49: "#262113",
  50: "#ffff00",
  51: "#ffff7f",
  52: "#a5a500",
  53: "#a5a552",
  54: "#7f7f00",
  55: "#7f7f3f",
  56: "#4c4c00",
  57: "#4c4c26",
  58: "#262600",
  59: "#262613",
  60: "#bfff00",
  61: "#dfff7f",
  62: "#7ca500",
  63: "#91a552",
  64: "#5f7f00",
  65: "#6f7f3f",
  66: "#394c00",
  67: "#424c26",
  68: "#1c2600",
  69: "#212613",
  70: "#7fff00",
  71: "#bfff7f",
  72: "#52a500",
  73: "#7ca552",
  74: "#3f7f00",
  75: "#5f7f3f",
  76: "#264c00",
  77: "#394c26",
  78: "#132600",
  79: "#1c2613",
  80: "#3fff00",
  81: "#9fff7f",
  82: "#29a500",
  83: "#67a552",
  84: "#1f7f00",
  85: "#4f7f3f",
  86: "#134c00",
  87: "#2f4c26",
  88: "#092600",
  89: "#172613",
  90: "#00ff00",
  91: "#7fff7f",
  92: "#00a500",
  93: "#52a552",
  94: "#007f00",
  95: "#3f7f3f",
  96: "#004c00",
  97: "#264c26",
  98: "#002600",
  99: "#132613",
  100: "#00ff3f",
  101: "#7fff9f",
  102: "#00a529",
  103: "#52a567",
  104: "#007f1f",
  105: "#3f7f4f",
  106: "#004c13",
  107: "#264c2f",
  108: "#002609",
  109: "#132617",
  110: "#00ff7f",
  111: "#7fffbf",
  112: "#00a552",
  113: "#52a57c",
  114: "#007f3f",
  115: "#3f7f5f",
  116: "#004c26",
  117: "#264c39",
  118: "#002613",
  119: "#13261c",
  120: "#00ffbf",
  121: "#7fffdf",
  122: "#00a57c",
  123: "#52a591",
  124: "#007f5f",
  125: "#3f7f6f",
  126: "#004c39",
  127: "#264c42",
  128: "#00261c",
  129: "#132621",
  130: "#00ffff",
  131: "#7fffff",
  132: "#00a5a5",
  133: "#52a5a5",
  134: "#007f7f",
  135: "#3f7f7f",
  136: "#004c4c",
  137: "#264c4c",
  138: "#002626",
  139: "#132626",
  140: "#00bfff",
  141: "#7fdfff",
  142: "#007ca5",
  143: "#5291a5",
  144: "#005f7f",
  145: "#3f6f7f",
  146: "#00394c",
  147: "#26424c",
  148: "#001c26",
  149: "#132126",
  150: "#007fff",
  151: "#7fbfff",
  152: "#0052a5",
  153: "#527ca5",
  154: "#003f7f",
  155: "#3f5f7f",
  156: "#00264c",
  157: "#26394c",
  158: "#001326",
  159: "#131c26",
  160: "#003fff",
  161: "#7f9fff",
  162: "#0029a5",
  163: "#5267a5",
  164: "#001f7f",
  165: "#3f4f7f",
  166: "#00134c",
  167: "#262f4c",
  168: "#000926",
  169: "#131726",
  170: "#0000ff",
  171: "#7f7fff",
  172: "#0000a5",
  173: "#5252a5",
  174: "#00007f",
  175: "#3f3f7f",
  176: "#00004c",
  177: "#26264c",
  178: "#000026",
  179: "#131326",
  180: "#3f00ff",
  181: "#9f7fff",
  182: "#2900a5",
  183: "#6752a5",
  184: "#1f007f",
  185: "#4f3f7f",
  186: "#13004c",
  187: "#2f264c",
  188: "#090026",
  189: "#171326",
  190: "#7f00ff",
  191: "#bf7fff",
  192: "#5200a5",
  193: "#7c52a5",
  194: "#3f007f",
  195: "#5f3f7f",
  196: "#26004c",
  197: "#39264c",
  198: "#130026",
  199: "#1c1326",
  200: "#bf00ff",
  201: "#df7fff",
  202: "#7c00a5",
  203: "#9152a5",
  204: "#5f007f",
  205: "#6f3f7f",
  206: "#39004c",
  207: "#42264c",
  208: "#1c0026",
  209: "#211326",
  210: "#ff00ff",
  211: "#ff7fff",
  212: "#a500a5",
  213: "#a552a5",
  214: "#7f007f",
  215: "#7f3f7f",
  216: "#4c004c",
  217: "#4c264c",
  218: "#260026",
  219: "#261326",
  220: "#ff00bf",
  221: "#ff7fdf",
  222: "#a5007c",
  223: "#a55291",
  224: "#7f005f",
  225: "#7f3f6f",
  226: "#4c0039",
  227: "#4c2642",
  228: "#26001c",
  229: "#261321",
  230: "#ff007f",
  231: "#ff7fbf",
  232: "#a50052",
  233: "#a5527c",
  234: "#7f003f",
  235: "#7f3f5f",
  236: "#4c0026",
  237: "#4c2639",
  238: "#260013",
  239: "#26131c",
  240: "#ff003f",
  241: "#ff7f9f",
  242: "#a50029",
  243: "#a55267",
  244: "#7f001f",
  245: "#7f3f4f",
  246: "#4c0013",
  247: "#4c262f",
  248: "#260009",
  249: "#261317",
  250: "#333333",
  251: "#505050",
  252: "#696969",
  253: "#828282",
  254: "#bebebe",
  255: "#ffffff"
};
function Ae(t, e = "#ffffff", n = e) {
  var i;
  if (typeof t != "number" || Number.isNaN(t)) return e;
  const s = Math.abs(Math.trunc(t));
  return s === 0 || s === 256 || s === 257 ? e : s === 7 ? n : (i = dl[s]) != null ? i : e;
}
function ht(t, e = "rgb") {
  const n = Math.max(0, Math.trunc(t)) & 16777215, s = n >> 16 & 255, i = n >> 8 & 255, o = n & 255;
  return `rgb(${e === "rgb" ? s : o}, ${i}, ${e === "rgb" ? o : s})`;
}
function Ee(t) {
  var e, n, s, i, o, r;
  if (typeof t == "string") {
    const a = t.trim();
    return a ? /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(a) ? (e = ml(a)) != null ? e : a : {
      red: "#ff0000",
      yellow: "#ffff00",
      green: "#00ff00",
      cyan: "#00ffff",
      blue: "#0000ff",
      magenta: "#ff00ff",
      white: "#ffffff",
      black: "#000000",
      grey: "#808080",
      gray: "#808080"
    }[a.toLowerCase()] : void 0;
  }
  if (t && typeof t == "object") {
    const a = t, c = Number((n = a.r) != null ? n : a.red), l = Number((s = a.g) != null ? s : a.green), h = Number((i = a.b) != null ? i : a.blue), u = Number((r = (o = a.a) != null ? o : a.alpha) != null ? r : 1);
    if ([c, l, h].every(Number.isFinite))
      return Number.isFinite(u) && u >= 0 && u < 1 ? `rgba(${c}, ${l}, ${h}, ${u})` : `rgb(${c}, ${l}, ${h})`;
  }
}
function ml(t) {
  if (!t) return;
  const e = t.trim();
  if (/^#[0-9a-f]{8}$/i.test(e)) {
    const n = parseInt(e.slice(1, 3), 16) / 255, s = parseInt(e.slice(3, 5), 16), i = parseInt(e.slice(5, 7), 16), o = parseInt(e.slice(7, 9), 16);
    return n >= 0.999 ? `rgb(${s}, ${i}, ${o})` : `rgba(${s}, ${i}, ${o}, ${un(n)})`;
  }
  if (/^#[0-9a-f]{6}$/i.test(e) || /^#[0-9a-f]{3}$/i.test(e)) return e;
  if (/^sc#/i.test(e)) {
    const n = e.slice(3).split(",").map((a) => Number(a.trim())), [s, i, o, r] = n.length === 4 ? n : [1, ...n];
    if ([s, i, o, r].every(Number.isFinite)) return `rgba(${Math.round(i * 255)}, ${Math.round(o * 255)}, ${Math.round(r * 255)}, ${un(s)})`;
  }
}
function $e(t, e, n = {}) {
  var a, c, l, h, u;
  const s = (a = n.foreground) != null ? a : "#ffffff", i = s;
  let o;
  const r = (l = (c = Ee(t.trueColor)) != null ? c : Ee(t.color)) != null ? l : Ee(t.colorName);
  if (r && (o = r), !o) {
    const f = Cl(t, ["trueColor", "true_color", "truecolor", "colorRGB", "colorRgb", "rgbColor", "rgb"]);
    typeof f == "number" && f >= 0 && f <= 16777215 && (o = ht(f, (h = n.trueColorByteOrder) != null ? h : "rgb"));
  }
  if (!o) {
    const f = ur(t.colorIndex, t.colorNumber, t.aci);
    typeof f == "number" && Math.abs(f) <= 257 && f !== 256 && f !== 0 && f !== 257 && (o = Ae(f, i, s));
  }
  if (!o && typeof t.color == "number") {
    const f = Number(t.color);
    Math.abs(f) <= 257 ? f !== 0 && f !== 256 && f !== 257 && (o = Ae(f, i, s)) : o = ht(f, (u = n.trueColorByteOrder) != null ? u : "rgb");
  }
  if (!o) {
    const f = wl(e, t.layer);
    o = yl(f, n);
  }
  return cr(o != null ? o : i, e, n);
}
function cn(t, e, n = {}) {
  var o, r, a, c, l;
  let s;
  const i = Ee(t.fillColor);
  if (i && (s = i), !s && typeof t.fillColor == "number") {
    const h = t.fillColor;
    s = Math.abs(h) <= 257 ? Ae(h, (o = n.foreground) != null ? o : "#ffffff", (r = n.foreground) != null ? r : "#ffffff") : ht(h, (a = n.trueColorByteOrder) != null ? a : "rgb");
  }
  return !s && typeof t.fillColorIndex == "number" && (s = Ae(t.fillColorIndex, (c = n.foreground) != null ? c : "#ffffff", (l = n.foreground) != null ? l : "#ffffff")), s ? cr(s, e, n) : void 0;
}
function pl(t, e, n = {}) {
  var c, l, h, u, f;
  const s = Sn(e);
  if (((c = n.colorMode) != null ? c : s.mode) !== "monochrome") return t;
  const o = Ee((u = (h = (l = n.monochromeColor) != null ? l : s.monochromeColor) != null ? h : n.foreground) != null ? u : "#000000");
  if (!o) return t;
  const r = nt(o);
  if (!r) return o;
  const a = nt(t);
  return hn({
    r: r.r,
    g: r.g,
    b: r.b,
    a: r.a * ((f = a == null ? void 0 : a.a) != null ? f : 1)
  });
}
function cr(t, e, n) {
  var r;
  const s = Sn(e), i = (r = n.colorMode) != null ? r : s.mode, o = pl(t, e, n);
  return i === "monochrome" ? o : gl(o, n);
}
function gl(t, e = {}) {
  var i, o, r;
  if (e.contrastMode !== "adaptive") return t;
  const n = (i = e.background) != null ? i : "#0b1020", s = (o = e.foreground) != null ? o : "#ffffff";
  return bl(t, n, s, (r = e.minColorContrast) != null ? r : 2.4);
}
function bl(t, e, n, s = 2.4) {
  var h, u;
  const i = (h = nt(n)) != null ? h : { r: 255, g: 255, b: 255, a: 1 }, o = (u = nt(e)) != null ? u : { r: 11, g: 16, b: 32, a: 1 }, r = nt(t);
  if (!r) return t;
  const a = uo(r, o);
  if (Vt(a, o) >= s) return t;
  const c = ln(o), l = c < 0.5 ? { r: 255, g: 255, b: 255, a: r.a } : { r: 0, g: 0, b: 0, a: r.a };
  for (const f of [0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
    const d = Sl(r, l, f);
    if (Vt(uo(d, o), o) >= s) return hn(d);
  }
  return Vt(i, o) >= s ? hn(i) : c < 0.5 ? "#ffffff" : "#000000";
}
function lr(t) {
  return t ? t.isVisible !== false && t.isFrozen !== true : true;
}
function yl(t, e) {
  var o, r, a;
  if (!t) return;
  const n = (o = e.foreground) != null ? o : "#ffffff", s = Ee(t.trueColor);
  if (s) return s;
  if (typeof t.trueColor == "number" && t.trueColor >= 0 && t.trueColor <= 16777215) return ht(t.trueColor, (r = e.trueColorByteOrder) != null ? r : "rgb");
  const i = Ee(t.color);
  if (i) return i;
  if (vl(t.colorIndex)) return Ae(t.colorIndex, n, n);
  if (typeof t.color == "number") {
    const c = Number(t.color);
    return Math.abs(c) <= 257 ? Ae(c, n, n) : ht(c, (a = e.trueColorByteOrder) != null ? a : "rgb");
  }
  if (typeof t.colorIndex == "number") return Ae(t.colorIndex, n, n);
}
function xl(t) {
  return ur(t.colorIndex, t.colorNumber, t.aci) === 0 ? true : t.trueColor === void 0 && t.color === 0;
}
function hr(t, e, n, s = {}) {
  if (!xl(t)) return t;
  const i = $e(e, n, { ...s, colorMode: "source" });
  return { ...t, color: i, trueColor: void 0, colorIndex: void 0, colorNumber: void 0 };
}
function vl(t) {
  return typeof t == "number" && Number.isFinite(t) && Math.abs(Math.trunc(t)) >= 1 && Math.abs(Math.trunc(t)) <= 255;
}
function wl(t, e) {
  var n, s;
  if (!(!t || !e))
    return (s = (n = t.layers[e]) != null ? n : t.layers[e.toLowerCase()]) != null ? s : Object.values(t.layers).find((i) => i.name.toLowerCase() === e.toLowerCase());
}
function ur(...t) {
  for (const e of t)
    if (typeof e == "number" && Number.isFinite(e)) return e;
}
function Cl(t, e) {
  const n = t;
  for (const s of e) {
    const i = n[s];
    if (typeof i == "number" && Number.isFinite(i)) return i;
  }
}
function nt(t) {
  const e = t.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(e))
    return {
      r: parseInt(e[1] + e[1], 16),
      g: parseInt(e[2] + e[2], 16),
      b: parseInt(e[3] + e[3], 16),
      a: 1
    };
  if (/^#[0-9a-f]{6}$/i.test(e))
    return {
      r: parseInt(e.slice(1, 3), 16),
      g: parseInt(e.slice(3, 5), 16),
      b: parseInt(e.slice(5, 7), 16),
      a: 1
    };
  const n = e.match(/^rgba?\(([^)]+)\)$/i);
  if (n) {
    const s = n[1].split(/[,\s/]+/).filter(Boolean).map((i) => Number(i.replace("%", "")));
    if (s.length >= 3 && s.slice(0, 3).every(Number.isFinite)) {
      const i = /%/.test(n[1]);
      return {
        r: Xe(i ? s[0] * 2.55 : s[0]),
        g: Xe(i ? s[1] * 2.55 : s[1]),
        b: Xe(i ? s[2] * 2.55 : s[2]),
        a: Number.isFinite(s[3]) ? Math.max(0, Math.min(1, s[3])) : 1
      };
    }
  }
}
function uo(t, e) {
  const n = t.a + e.a * (1 - t.a);
  return n <= 0 ? { r: 0, g: 0, b: 0, a: 0 } : {
    r: (t.r * t.a + e.r * e.a * (1 - t.a)) / n,
    g: (t.g * t.a + e.g * e.a * (1 - t.a)) / n,
    b: (t.b * t.a + e.b * e.a * (1 - t.a)) / n,
    a: n
  };
}
function Sl(t, e, n) {
  const s = Math.max(0, Math.min(1, n));
  return {
    r: t.r + (e.r - t.r) * s,
    g: t.g + (e.g - t.g) * s,
    b: t.b + (e.b - t.b) * s,
    a: t.a
  };
}
function ln(t) {
  const e = [t.r, t.g, t.b].map((n) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * e[0] + 0.7152 * e[1] + 0.0722 * e[2];
}
function Vt(t, e) {
  const n = ln(t), s = ln(e), i = Math.max(n, s), o = Math.min(n, s);
  return (i + 0.05) / (o + 0.05);
}
function hn(t) {
  const e = Xe(t.r), n = Xe(t.g), s = Xe(t.b);
  return t.a < 0.999 ? `rgba(${e}, ${n}, ${s}, ${un(t.a)})` : `rgb(${e}, ${n}, ${s})`;
}
function Xe(t) {
  return Math.max(0, Math.min(255, Math.round(t)));
}
function un(t) {
  return Math.round(t * 1e3) / 1e3;
}
var kl = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
function Tt(t, e) {
  return {
    a: t.a * e.a + t.c * e.b,
    b: t.b * e.a + t.d * e.b,
    c: t.a * e.c + t.c * e.d,
    d: t.b * e.c + t.d * e.d,
    e: t.a * e.e + t.c * e.f + t.e,
    f: t.b * e.e + t.d * e.f + t.f
  };
}
function fo(t, e) {
  return { a: 1, b: 0, c: 0, d: 1, e: t, f: e };
}
function fr(t) {
  const e = Math.cos(t), n = Math.sin(t);
  return { a: e, b: n, c: -n, d: e, e: 0, f: 0 };
}
function Nl(t, e = t) {
  return { a: t, b: 0, c: 0, d: e, e: 0, f: 0 };
}
function re(t, e) {
  return {
    x: t.x * e.a + t.y * e.c + e.e,
    y: t.x * e.b + t.y * e.d + e.f,
    z: "z" in t ? t.z : void 0
  };
}
function mo(t, e) {
  if (t)
    return t.map((n) => ({ cmd: n.cmd, points: n.points.map((s) => re(s, e)) }));
}
function kn(t, e = { x: 0, y: 0 }) {
  var c, l, h, u, f, d;
  const n = (c = t.insertionPoint) != null ? c : { x: 0, y: 0 }, s = t.scale, i = Number(typeof s == "object" && s ? (l = s.x) != null ? l : 1 : (h = t.scaleX) != null ? h : 1), o = Number(typeof s == "object" && s ? (u = s.y) != null ? u : i : (f = t.scaleY) != null ? f : i), r = Number((d = t.rotation) != null ? d : 0);
  let a = fo(n.x, n.y);
  return a = Tt(a, fr(Number.isFinite(r) ? r : 0)), a = Tt(a, Nl(Number.isFinite(i) ? i : 1, Number.isFinite(o) ? o : 1)), a = Tt(a, fo(-e.x, -e.y)), a;
}
function Ye(t, e) {
  var l, h, u;
  const n = { ...t }, s = e.a * e.d - e.b * e.c, i = Math.sqrt(Math.abs(s)), o = Math.hypot(e.a, e.b), r = Math.hypot(e.c, e.d);
  if (t.startPoint && (n.startPoint = re(t.startPoint, e)), t.endPoint && (n.endPoint = re(t.endPoint, e)), t.center && (n.center = re(t.center, e)), t.insertionPoint && (n.insertionPoint = re(t.insertionPoint, e)), t.majorAxisEndPoint) {
    const f = re({ x: 0, y: 0 }, e), d = re(t.majorAxisEndPoint, e);
    n.majorAxisEndPoint = { x: d.x - f.x, y: d.y - f.y, z: d.z };
  }
  t.vertices && (n.vertices = t.vertices.map((f) => ({
    ...re(f, e),
    bulge: f.bulge,
    startWidth: po(f.startWidth, i),
    endWidth: po(f.endWidth, i)
  }))), t.points && (n.points = t.points.map((f) => re(f, e))), t.controlPoints && (n.controlPoints = t.controlPoints.map((f) => re(f, e))), t.fitPoints && (n.fitPoints = t.fitPoints.map((f) => re(f, e))), t.attribs && (n.attribs = t.attribs.map((f) => Ye(f, e))), t.commands && (n.commands = mo(t.commands, e)), t.loops && (n.loops = t.loops.map((f) => {
    var d;
    return {
      ...f,
      vertices: (d = f.vertices) == null ? void 0 : d.map((m) => re(m, e)),
      commands: mo(f.commands, e)
    };
  })), typeof t.radius == "number" && Number.isFinite(i) && (n.radius = t.radius * i), typeof t.constantWidth == "number" && Number.isFinite(i) && (n.constantWidth = t.constantWidth * i), typeof t.thickness == "number" && Number.isFinite(i) && (n.thickness = t.thickness * i), typeof t.lineTypeScale == "number" && Number.isFinite(i) && (n.lineTypeScale = t.lineTypeScale * i), (t.kind === "text" || /^(TEXT|MTEXT|ATTRIB|ATTDEF|DIMENSION)$/i.test(String((l = t.type) != null ? l : ""))) && (typeof t.textHeight == "number" && Number.isFinite(r) && (n.textHeight = t.textHeight * r), typeof t.height == "number" && Number.isFinite(r) && (n.height = t.height * r), typeof t.xScale == "number" && r > 1e-14 && Number.isFinite(o) && (n.xScale = t.xScale * o / r));
  const a = Math.atan2(e.b, e.a), c = t.kind === "ellipse" || String((h = t.type) != null ? h : "").toUpperCase() === "ELLIPSE";
  return (typeof t.rotation == "number" || t.kind === "text" || t.kind === "insert") && (n.rotation = Pl(Number((u = t.rotation) != null ? u : 0) + (Number.isFinite(a) ? a : 0))), Number.isFinite(a) && Math.abs(a) > 1e-14 && (!c && typeof t.startAngle == "number" && (n.startAngle = t.startAngle + a), !c && typeof t.endAngle == "number" && (n.endAngle = t.endAngle + a)), s < 0 && n.vertices && (n.vertices = n.vertices.map((f) => ({ ...f, bulge: typeof f.bulge == "number" ? -f.bulge : void 0 }))), n;
}
function po(t, e) {
  return typeof t == "number" && Number.isFinite(e) ? t * e : t;
}
function Pl(t) {
  if (!Number.isFinite(t)) return t;
  const e = Math.PI * 2, n = ((t + Math.PI) % e + e) % e - Math.PI;
  return Math.abs(n) <= 1e-12 ? 0 : n;
}
var Ml = 16;
var Tl = 96;
var Al = 0.01;
function dr(t, e = {}) {
  var i;
  const n = fe();
  for (const o of (i = t.pages) != null ? i : [])
    K(n, { x: 0, y: 0 }), K(n, { x: o.width, y: o.height });
  const s = pr(t, e);
  for (const o of t.entities) Oo(n, gr(o, s));
  return _o(n);
}
function mr(t, e, n = "auto", s = {}) {
  if (n === "extents") return e;
  const i = El(t);
  if (!i) return e;
  if (n === "saved-view") return i;
  const o = fe(), r = pr(t, s);
  let a = 0;
  for (const c of t.entities) {
    const l = Dl(gr(c, r), i);
    l && (a++, Oo(o, l));
  }
  return a === 0 || !Bl(o, i) ? i : _o(o);
}
function El(t) {
  const e = t.savedView;
  if (!e || e.source !== "vport" || e.sceneTransformApplied !== true || !L(e.center)) return;
  const n = Number(e.viewHeight), s = Number(e.aspectRatio);
  if (!Number.isFinite(n) || n <= 1e-9 || !Number.isFinite(s) || s <= 1e-9) return;
  const i = n * s;
  return {
    minX: e.center.x - i / 2,
    minY: e.center.y - n / 2,
    maxX: e.center.x + i / 2,
    maxY: e.center.y + n / 2
  };
}
function pr(t, e) {
  var n, s;
  return {
    document: t,
    maxInsertDepth: Math.max(0, Math.floor((n = e.maxInsertDepth) != null ? n : Ml)),
    maxCurveSegments: Math.max(12, Math.floor((s = e.maxCurveSegments) != null ? s : Tl))
  };
}
function gr(t, e, n = 0) {
  const s = fe();
  return br(s, t, e, n), s;
}
function br(t, e, n, s) {
  var r, a, c, l, h, u, f, d, m, p, g, b, y, v, x;
  if (!e) return;
  const i = String((r = e.type) != null ? r : "").toUpperCase(), o = (a = e.kind) != null ? a : ot(i);
  if (o === "insert") {
    const w = Il(n.document, (c = e.blockName) != null ? c : e.name);
    if (w && s < n.maxInsertDepth) {
      const C = kn(e, (l = w.basePoint) != null ? l : { x: 0, y: 0 });
      for (const N of w.entities) br(t, Ye(N, C), n, s + 1);
      return;
    }
  }
  if (o === "line")
    L(e.startPoint) && K(t, e.startPoint), L(e.endPoint) && K(t, e.endPoint);
  else if (o === "circle" || o === "arc")
    L(e.center) && Number.isFinite(e.radius) && qr(t, e.center, Number(e.radius));
  else if (o === "polyline" || o === "solid" || o === "spline")
    for (const w of [...(h = e.vertices) != null ? h : [], ...(u = e.points) != null ? u : [], ...(f = e.controlPoints) != null ? f : [], ...(d = e.fitPoints) != null ? d : []])
      L(w) && K(t, w);
  else if (o === "ellipse") {
    if (L(e.center) && L(e.majorAxisEndPoint))
      for (const w of gn(
        e.center,
        e.majorAxisEndPoint,
        Number((m = e.axisRatio) != null ? m : 1),
        Number((p = e.startAngle) != null ? p : 0),
        Number((g = e.endAngle) != null ? g : Math.PI * 2),
        n.maxCurveSegments
      )) K(t, w);
  } else if (o === "path")
    for (const w of (b = e.commands) != null ? b : []) for (const C of w.points) K(t, C);
  else if (o === "hatch")
    for (const w of (y = e.loops) != null ? y : []) {
      for (const C of (v = w.vertices) != null ? v : []) K(t, C);
      for (const C of (x = w.commands) != null ? x : []) for (const N of C.points) K(t, N);
    }
  else {
    const w = Ll(e);
    w && K(t, w);
  }
}
function Ll(t) {
  for (const e of ["startPoint", "insertionPoint", "center", "point", "location"]) {
    const n = t[e];
    if (L(n)) return n;
  }
  if (Array.isArray(t.vertices) && L(t.vertices[0])) return t.vertices[0];
  if (Array.isArray(t.commands)) {
    const e = t.commands.find((n) => n.points.length > 0);
    if (e) return e.points[0];
  }
}
function Il(t, e) {
  var n, s;
  if (e)
    return (s = (n = t.blocks[e]) != null ? n : t.blocks[e.toLowerCase()]) != null ? s : Object.values(t.blocks).find((i) => i.name.toLowerCase() === e.toLowerCase());
}
function Dl(t, e) {
  if (!ae(t) || !ae(e)) return;
  const n = {
    minX: Math.max(t.minX, e.minX),
    minY: Math.max(t.minY, e.minY),
    maxX: Math.min(t.maxX, e.maxX),
    maxY: Math.min(t.maxY, e.maxY)
  };
  return ae(n) ? n : void 0;
}
function Bl(t, e) {
  if (!ae(t) || !ae(e)) return false;
  const n = Math.hypot(t.maxX - t.minX, t.maxY - t.minY), s = Math.hypot(e.maxX - e.minX, e.maxY - e.minY);
  return s > 1e-9 && n / s >= Al;
}
var go = 1e5;
var yr = /* @__PURE__ */ new Set(["", "bylayer", "15"]);
var Nn = /* @__PURE__ */ new Set(["byblock", "14"]);
var Rl = /* @__PURE__ */ new Set(["continuous", "16"]);
var We = (t) => String(t != null ? t : "").trim().toLowerCase();
function Fl(t) {
  return Nn.has(We(t));
}
function xr(t, e, n) {
  if (!Fl(t.lineType)) return t;
  const s = vr(e, n);
  return {
    ...t,
    lineType: s || "Continuous",
    lineTypeScale: st(t.lineTypeScale, 1) * st(e.lineTypeScale, 1)
  };
}
function vr(t, e) {
  var i, o, r;
  let n = String((i = t.lineType) != null ? i : "").trim();
  const s = We(n);
  return yr.has(s) ? n = (r = (o = Wl(e, t.layer)) == null ? void 0 : o.lineType) != null ? r : "Continuous" : Nn.has(s) && (n = "Continuous"), n || "Continuous";
}
function fn(t, e) {
  var u, f;
  if (!e) return;
  const n = vr(t, e), s = We(n);
  if (Rl.has(s) || yr.has(s) || Nn.has(s)) return;
  const i = Xl(e, n);
  if (!(i != null && i.pattern.length)) return;
  const o = st(t.lineTypeScale, st((u = e.header) == null ? void 0 : u.CELTSCALE, 1)), r = st((f = e.header) == null ? void 0 : f.LTSCALE, 1) * o, a = Ol(i, r), c = a.reduce((d, m) => d + m.length, 0);
  if (!Number.isFinite(c) || c <= 1e-9) return;
  const l = a.some((d) => !d.draw && d.length > 1e-12), h = a.some((d) => d.marker);
  if (!(!l && !h))
    return { name: i.name, segments: $l(a, l), runs: a, period: c };
}
function Pn(t, e, n, s = go) {
  const i = t.filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y));
  if (i.length < 2 || n.runs.length === 0) return { segments: [], dots: [] };
  const o = [];
  for (let b = 0; b < i.length - 1; b++) o.push([i[b], i[b + 1]]);
  e && o.push([i[i.length - 1], i[0]]);
  const r = Number.isFinite(s) ? Math.max(1, Math.floor(s)) : go, a = o.reduce((b, [y, v]) => b + Math.hypot(v.x - y.x, v.y - y.y), 0), l = (n.period > 1e-12 ? a / n.period : Number.POSITIVE_INFINITY) * Math.max(1, n.runs.length);
  if (!Number.isFinite(l) || l > r)
    return { segments: o, dots: [] };
  const h = { segments: [], dots: [] };
  let u = 0, f = n.runs[0].length, d = true;
  const m = (b) => {
    const y = h.dots[h.dots.length - 1];
    y && Math.hypot(y.x - b.x, y.y - b.y) <= 1e-10 || h.dots.push(b);
  }, p = () => {
    u = (u + 1) % n.runs.length, f = n.runs[u].length, d = true;
  }, g = (b, y, v, x, w) => {
    var N;
    const C = _l(b, y, v / w, x / w);
    m(y), C && ((N = h.markers) != null ? N : h.markers = []).push(C);
  };
  for (const [b, y] of o) {
    const v = y.x - b.x, x = y.y - b.y, w = Math.hypot(v, x);
    if (w <= 1e-14) continue;
    let C = 0;
    for (; C < w - 1e-12; ) {
      let N = 0;
      for (; f <= 1e-12 && N < n.runs.length; ) {
        const I = n.runs[u];
        if (d && I.marker) {
          const P = C / w, M = { x: b.x + v * P, y: b.y + x * P };
          bo(I) ? g(I, M, v, x, w) : m(M);
        }
        p(), N++;
      }
      if (f <= 1e-12) break;
      const B = n.runs[u];
      if (d) {
        if (B.marker) {
          const I = C / w, P = { x: b.x + v * I, y: b.y + x * I };
          bo(B) ? g(B, P, v, x, w) : m(P);
        }
        d = false;
      }
      const D = Math.min(f, w - C);
      if (B.draw && D > 1e-12) {
        const I = C / w, P = (C + D) / w;
        h.segments.push([
          { x: b.x + v * I, y: b.y + x * I },
          { x: b.x + v * P, y: b.y + x * P }
        ]);
      }
      C += D, f -= D, f <= 1e-12 && p();
    }
  }
  return h;
}
function Ol(t, e) {
  var s;
  const n = [];
  for (const i of t.pattern) {
    const o = Number(i.length), r = Number((s = i.elementTypeFlag) != null ? s : 0) !== 0;
    Number.isFinite(o) && n.push({
      draw: o >= 0,
      length: Math.abs(o) * e,
      marker: o >= 0 && (o === 0 || r),
      element: i,
      globalScale: e
    });
  }
  return n;
}
function wr(t, e) {
  const n = Math.cos(t.angle), s = Math.sin(t.angle);
  return e.polylines.map((i) => i.map((o) => {
    const r = o.x * t.scale, a = o.y * t.scale;
    return {
      x: t.point.x + r * n - a * s,
      y: t.point.y + r * s + a * n
    };
  }));
}
function bo(t) {
  var e, n;
  return Number((n = (e = t.element) == null ? void 0 : e.elementTypeFlag) != null ? n : 0) !== 0;
}
function _l(t, e, n, s) {
  var d;
  const i = t.element, o = Number((d = i == null ? void 0 : i.elementTypeFlag) != null ? d : 0);
  if (!i || o === 0) return;
  const r = kt(i.offsetX, 0) * t.globalScale, a = kt(i.offsetY, 0) * t.globalScale, c = kt(i.rotation, 0), l = Math.atan2(s, n), h = {
    x: e.x + n * r - s * a,
    y: e.y + s * r + n * a
  }, u = {
    fallbackPoint: e,
    point: h,
    angle: (o & 1) === 1 ? c : l + c,
    scale: Math.abs(kt(i.scale, 1) * t.globalScale),
    fontName: i.fontName
  }, f = Number(i.shapeNumber);
  if ((o & 4) === 4 && Number.isFinite(f))
    return { ...u, kind: "shape", shapeNumber: Math.trunc(f) };
  if ((o & 2) === 2 && i.text)
    return { ...u, kind: "text", text: i.text };
}
function $l(t, e) {
  if (!e) return [];
  const n = [];
  for (const i of t) {
    if (i.length <= 1e-12) continue;
    const o = n[n.length - 1];
    (o == null ? void 0 : o.draw) === i.draw ? o.length += i.length : n.push({ draw: i.draw, length: i.length });
  }
  const s = [];
  for (const i of n) {
    const o = s.length % 2 === 0;
    i.draw !== o && s.push(1e-9), s.push(i.length);
  }
  return s.length % 2 === 1 && s.push(1e-9), s;
}
function Xl(t, e) {
  var i, o, r;
  const n = We(e), s = (i = t.lineTypes) != null ? i : {};
  return (r = (o = s[e]) != null ? o : s[n]) != null ? r : Object.values(s).find((a) => We(a.name) === n || We(a.handle) === n);
}
function Wl(t, e) {
  var n, s;
  if (!(!t || !e))
    return (s = (n = t.layers[e]) != null ? n : t.layers[e.toLowerCase()]) != null ? s : Object.values(t.layers).find((i) => i.name.toLowerCase() === e.toLowerCase());
}
function st(t, e) {
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : e;
}
function kt(t, e) {
  const n = Number(t);
  return Number.isFinite(n) ? n : e;
}
var Ul = (t) => Math.abs(t.a - 1) < 1e-12 && Math.abs(t.b) < 1e-12 && Math.abs(t.c) < 1e-12 && Math.abs(t.d - 1) < 1e-12 && Math.abs(t.e) < 1e-9 && Math.abs(t.f) < 1e-9;
function Cr(t) {
  var n, s, i, o;
  if (t.metadata.sceneTransformApplied === true || ((n = t.savedView) == null ? void 0 : n.sceneTransformApplied) === false) return t;
  const e = (i = (s = t.savedView) == null ? void 0 : s.sceneTransform) != null ? i : kl;
  return Ul(e) ? t : {
    ...t,
    entities: t.entities.map((r) => Ye(r, e)),
    pages: (o = t.pages) == null ? void 0 : o.map((r) => ({
      ...r,
      entities: r.entities.map((a) => Ye(a, e))
    })),
    metadata: {
      ...t.metadata,
      sceneTransformApplied: true
    }
  };
}
var zl = {
  background: "#0b1020",
  foreground: "#ffffff",
  showUnsupportedMarkers: false,
  showImagePlaceholders: true,
  showPageBounds: true,
  minScale: 1e-9,
  maxScale: 1e9,
  wheelZoomFactor: 1.14,
  trueColorByteOrder: "rgb",
  maxInsertDepth: 16,
  fitMode: "auto",
  contrastMode: "adaptive",
  minColorContrast: 2.4,
  maxCurveSegments: 96,
  spatialIndexCellCount: 72,
  maxVerticesPerBatch: 65536,
  textMinPixelHeight: 4,
  maxVisibleTextLabels: 2500,
  powerPreference: "high-performance",
  antialias: true,
  preserveDrawingBuffer: false,
  enableSpatialIndex: true,
  shxGlyphResolver: ar
};
var yo = class {
  constructor(e, n = {}) {
    S(this, "canvas");
    S(this, "ctx");
    S(this, "opts");
    S(this, "sourceDocument");
    S(this, "document");
    S(this, "bounds", fe());
    S(this, "view", { centerX: 0, centerY: 0, scale: 1 });
    S(this, "fitScale", 1);
    S(this, "dpr", 1);
    S(this, "isDragging", false);
    S(this, "lastPointer");
    S(this, "resizeObserver");
    S(this, "imageCache", /* @__PURE__ */ new Map());
    S(this, "stats", { total: 0, drawn: 0, skipped: 0, byType: {}, unsupported: {}, renderElapsedMs: 0, backend: "canvas2d" });
    S(this, "onStats");
    S(this, "onViewChange");
    const s = e.getContext("2d");
    if (!s) throw new Error("Canvas 2D context is not available.");
    this.canvas = e, this.ctx = s, this.opts = { ...zl, ...n }, this.canvas.classList.add("cad-viewer-canvas"), this.bindEvents(), typeof ResizeObserver != "undefined" && (this.resizeObserver = new ResizeObserver(() => this.resize()), this.resizeObserver.observe(e)), this.resize();
  }
  captureCanvas() {
    return this.render(), yn([this.canvas]);
  }
  destroy() {
    var e;
    (e = this.resizeObserver) == null || e.disconnect();
  }
  clear() {
    this.sourceDocument = void 0, this.document = void 0, this.bounds = fe(), this.view = { centerX: 0, centerY: 0, scale: 1 }, this.fitScale = 1, this.render(), this.emitViewChange();
  }
  setDocument(e) {
    this.sourceDocument = e, this.document = Cr(e), this.bounds = dr(this.document, this.boundsOptions()), this.fitToView();
  }
  refreshReferences() {
    this.render(), this.emitViewChange();
  }
  getDocument() {
    return this.document;
  }
  getSourceDocument() {
    return this.sourceDocument;
  }
  setOptions(e) {
    const n = e.fitMode !== void 0 && e.fitMode !== this.opts.fitMode;
    if (Object.assign(this.opts, e), n && this.document) {
      this.fitToView();
      return;
    }
    this.render(), this.emitViewChange();
  }
  getOptions() {
    return { ...this.opts };
  }
  fitToView(e = 0.92, n = this.opts.fitMode) {
    const s = this.document ? mr(this.document, this.bounds, n, this.boundsOptions()) : this.bounds;
    if (!ae(s)) {
      this.view = { centerX: 0, centerY: 0, scale: 1 }, this.fitScale = 1, this.render(), this.emitViewChange();
      return;
    }
    const i = Math.max(1, this.cssWidth), o = Math.max(1, this.cssHeight), r = Math.max(s.maxX - s.minX, 1e-9), a = Math.max(s.maxY - s.minY, 1e-9), c = this.clampScale(Math.min(i / r, o / a) * e);
    this.fitScale = c, this.view = {
      centerX: (s.minX + s.maxX) / 2,
      centerY: (s.minY + s.maxY) / 2,
      scale: c
    }, this.render(), this.emitViewChange();
  }
  resize() {
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    const e = Math.max(1, Math.floor(this.cssWidth * this.dpr)), n = Math.max(1, Math.floor(this.cssHeight * this.dpr));
    (this.canvas.width !== e || this.canvas.height !== n) && (this.canvas.width = e, this.canvas.height = n), this.render(), this.emitViewChange();
  }
  zoom(e, n) {
    if (!Number.isFinite(e) || e <= 0) return;
    const s = n != null ? n : { x: this.cssWidth / 2, y: this.cssHeight / 2 }, i = this.screenToWorld(s);
    this.view.scale = this.clampScale(this.view.scale * e);
    const o = this.screenToWorld(s);
    this.view.centerX += i.x - o.x, this.view.centerY += i.y - o.y, this.render(), this.emitViewChange();
  }
  zoomIn() {
    this.zoom(this.opts.wheelZoomFactor);
  }
  zoomOut() {
    this.zoom(1 / this.opts.wheelZoomFactor);
  }
  panByScreenDelta(e, n) {
    !Number.isFinite(e) || !Number.isFinite(n) || (this.view.centerX -= e / this.view.scale, this.view.centerY += n / this.view.scale, this.render(), this.emitViewChange());
  }
  setViewState(e) {
    if (![e.centerX, e.centerY, e.scale].every(Number.isFinite)) throw new Error("Invalid view state.");
    this.view = { ...e, scale: this.clampScale(e.scale) }, this.render(), this.emitViewChange();
  }
  getViewState() {
    return { ...this.view };
  }
  getBounds() {
    return { ...this.bounds };
  }
  getStats() {
    return Yl(this.stats);
  }
  getZoomRatio() {
    return Math.abs(this.fitScale) < 1e-12 ? 1 : this.view.scale / this.fitScale;
  }
  getZoomPercent() {
    return this.getZoomRatio() * 100;
  }
  worldToScreen(e) {
    return {
      x: this.cssWidth / 2 + (e.x - this.view.centerX) * this.view.scale,
      y: this.cssHeight / 2 - (e.y - this.view.centerY) * this.view.scale
    };
  }
  screenToWorld(e) {
    return {
      x: this.view.centerX + (e.x - this.cssWidth / 2) / this.view.scale,
      y: this.view.centerY - (e.y - this.cssHeight / 2) / this.view.scale
    };
  }
  render() {
    var n, s;
    const e = performance.now();
    if (this.stats = { total: 0, drawn: 0, skipped: 0, byType: {}, unsupported: {}, renderElapsedMs: 0, backend: "canvas2d" }, this.clearCanvas(), this.document) {
      this.opts.showPageBounds && ((n = this.document.pages) != null && n.length) && this.drawPageBounds(this.document);
      for (const i of this.document.entities) this.drawEntityTracked(i, 0);
    }
    return this.stats.renderElapsedMs = performance.now() - e, (s = this.onStats) == null || s.call(this, this.getStats()), this.getStats();
  }
  get cssWidth() {
    return this.canvas.clientWidth || 1;
  }
  get cssHeight() {
    return this.canvas.clientHeight || 1;
  }
  bindEvents() {
    this.canvas.addEventListener("wheel", (n) => {
      n.preventDefault();
      const s = n.deltaY < 0 ? this.opts.wheelZoomFactor : 1 / this.opts.wheelZoomFactor;
      this.zoom(s, { x: n.offsetX, y: n.offsetY });
    }, { passive: false }), this.canvas.addEventListener("pointerdown", (n) => {
      this.canvas.setPointerCapture(n.pointerId), this.isDragging = true, this.lastPointer = { x: n.clientX, y: n.clientY }, this.canvas.classList.add("is-dragging");
    }), this.canvas.addEventListener("pointermove", (n) => {
      !this.isDragging || !this.lastPointer || (this.panByScreenDelta(n.clientX - this.lastPointer.x, n.clientY - this.lastPointer.y), this.lastPointer = { x: n.clientX, y: n.clientY });
    });
    const e = (n) => {
      n && this.canvas.hasPointerCapture(n.pointerId) && this.canvas.releasePointerCapture(n.pointerId), this.isDragging = false, this.lastPointer = void 0, this.canvas.classList.remove("is-dragging");
    };
    this.canvas.addEventListener("pointerup", e), this.canvas.addEventListener("pointercancel", () => e());
  }
  clearCanvas() {
    const e = this.ctx;
    e.save(), e.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), e.clearRect(0, 0, this.cssWidth, this.cssHeight), e.fillStyle = this.opts.background, e.fillRect(0, 0, this.cssWidth, this.cssHeight), e.restore();
  }
  drawPageBounds(e) {
    var s;
    const n = this.ctx;
    n.save(), n.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), n.strokeStyle = "rgba(148, 163, 184, 0.35)", n.lineWidth = 1, n.setLineDash([8, 6]);
    for (const i of (s = e.pages) != null ? s : []) {
      const o = this.worldToScreen({ x: 0, y: 0 }), r = this.worldToScreen({ x: i.width, y: i.height });
      n.strokeRect(Math.min(o.x, r.x), Math.min(o.y, r.y), Math.abs(r.x - o.x), Math.abs(r.y - o.y));
    }
    n.restore();
  }
  drawEntityTracked(e, n) {
    var o, r;
    if (!e) return;
    this.stats.total++;
    const s = String((o = e.type) != null ? o : "UNKNOWN").toUpperCase();
    this.stats.byType[s] = ((r = this.stats.byType[s]) != null ? r : 0) + 1;
    const i = this.lookupLayer(e.layer);
    if (e.isVisible === false || !lr(i)) {
      this.stats.skipped++;
      return;
    }
    this.drawEntity(e, s, n);
  }
  drawEntity(e, n, s) {
    var o, r;
    switch ((o = e.kind) != null ? o : ot(n)) {
      case "line":
        return this.drawLine(e);
      case "circle":
        return this.drawCircle(e);
      case "arc":
        return this.drawArc(e);
      case "polyline":
        return this.drawPolyline(e);
      case "ellipse":
        return this.drawEllipse(e);
      case "text":
        return this.drawText(e);
      case "point":
        return this.drawPoint(e);
      case "insert":
        return this.drawInsert(e, s);
      case "solid":
        return this.drawSolid(e);
      case "hatch":
        return this.drawHatch(e);
      case "spline":
        return this.drawSpline(e);
      case "path":
        return this.drawPath(e);
      case "image":
        return this.drawImage(e);
      case "viewport":
        return this.markSkipped(n);
      default:
        this.stats.unsupported[n] = ((r = this.stats.unsupported[n]) != null ? r : 0) + 1, this.stats.skipped++, this.opts.showUnsupportedMarkers && this.drawUnsupportedMarker(e);
    }
  }
  beginStyledPath(e, n = false, s = true) {
    var h, u;
    const i = this.ctx;
    i.save(), i.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const o = $e(e, this.document, { foreground: this.opts.foreground, background: this.opts.background, trueColorByteOrder: this.opts.trueColorByteOrder, contrastMode: this.opts.contrastMode, minColorContrast: this.opts.minColorContrast }), r = (h = cn(e, this.document, { foreground: this.opts.foreground, background: this.opts.background, trueColorByteOrder: this.opts.trueColorByteOrder, contrastMode: this.opts.contrastMode, minColorContrast: this.opts.minColorContrast })) != null ? h : o;
    i.strokeStyle = o, i.fillStyle = n ? r : o, i.globalAlpha = Re(Number((u = e.opacity) != null ? u : 1), 0, 1), i.lineCap = "round", i.lineJoin = "round";
    const a = typeof e.lineweight == "number" && e.lineweight > 0 ? e.lineweight / 30 : 1, c = Io(e) * Math.abs(this.view.scale);
    i.lineWidth = Math.max(1, Math.min(256, Math.max(a, Number.isFinite(c) ? c : 0)));
    const l = s ? fn(e, this.document) : void 0;
    i.setLineDash(l ? l.segments.map((f) => Math.max(0.05, f * this.view.scale)) : []), i.beginPath();
  }
  finishStroke() {
    this.ctx.stroke(), this.ctx.restore(), this.stats.drawn++;
  }
  finishFillStroke(e = false) {
    e && this.ctx.fill(), this.ctx.stroke(), this.ctx.restore(), this.stats.drawn++;
  }
  drawLine(e) {
    const n = e.startPoint, s = e.endPoint;
    if (!L(n) || !L(s)) return this.markSkipped("LINE");
    this.strokeWorldPolyline(e, [n, s], false);
  }
  drawCircle(e) {
    const n = e.center, s = Number(e.radius);
    if (!L(n) || !Number.isFinite(s)) return this.markSkipped("CIRCLE");
    this.strokeWorldPolyline(e, at(j(n), s, 0, Math.PI * 2, true), true);
  }
  drawArc(e) {
    const n = e.center, s = Number(e.radius), i = Number(e.startAngle), o = Number(e.endAngle);
    if (!L(n) || !Number.isFinite(s) || !Number.isFinite(i) || !Number.isFinite(o)) return this.markSkipped("ARC");
    this.strokeWorldPolyline(e, at(j(n), s, i, o, true), false);
  }
  drawPolyline(e) {
    var r, a;
    const n = (r = e.vertices) != null ? r : e.points;
    if (!Array.isArray(n) || n.length < 2) return this.markSkipped(String(e.type));
    const s = Lo(e), i = [], o = s ? n.length : n.length - 1;
    for (let c = 0; c < o; c++) {
      const l = n[c], h = n[(c + 1) % n.length];
      if (!L(l) || !L(h)) continue;
      const u = $o(l, h, Number((a = l.bulge) != null ? a : 0));
      i.length > 0 && u.shift(), i.push(...u);
    }
    this.strokeWorldPolyline(e, i, s);
  }
  drawEllipse(e) {
    var a, c, l, h, u;
    const n = e.center, s = e.majorAxisEndPoint, i = Number((a = e.axisRatio) != null ? a : 1);
    if (!L(n) || !L(s)) return this.markSkipped("ELLIPSE");
    const o = gn(n, s, i, Number((c = e.startAngle) != null ? c : 0), Number((l = e.endAngle) != null ? l : Math.PI * 2)), r = Math.abs(Number((h = e.endAngle) != null ? h : Math.PI * 2) - Number((u = e.startAngle) != null ? u : 0)) >= Math.PI * 2 - 1e-6;
    this.strokeWorldPolyline(e, o, r);
  }
  drawPoint(e) {
    var i, o, r;
    const n = (r = (o = (i = e.point) != null ? i : e.location) != null ? o : e.center) != null ? r : e.insertionPoint;
    if (!L(n)) return this.markSkipped("POINT");
    const s = this.worldToScreen(n);
    this.beginStyledPath(e), this.ctx.moveTo(s.x - 3, s.y), this.ctx.lineTo(s.x + 3, s.y), this.ctx.moveTo(s.x, s.y - 3), this.ctx.lineTo(s.x, s.y + 3), this.finishStroke();
  }
  drawText(e) {
    var r, a, c, l, h, u, f, d, m;
    const s = (Number((r = e.halign) != null ? r : 0) !== 0 || Number((a = e.valign) != null ? a : 0) !== 0) && L(e.endPoint) ? e.endPoint : (l = (c = e.insertionPoint) != null ? c : e.startPoint) != null ? l : e.center, i = Xo(String((u = (h = e.text) != null ? h : e.value) != null ? u : "")), o = Number((d = (f = e.textHeight) != null ? f : e.height) != null ? d : 1);
    if (!L(s) || !i) return this.markSkipped(String(e.type));
    this.drawTextAt(e, s, i, o, Number((m = e.rotation) != null ? m : 0));
  }
  drawInsert(e, n) {
    var a, c;
    const s = this.lookupBlock((a = e.blockName) != null ? a : e.name);
    if (s && n < this.opts.maxInsertDepth) {
      const l = kn(e, (c = s.basePoint) != null ? c : { x: 0, y: 0 });
      for (const h of s.entities) {
        if (!h) continue;
        const u = hr(h, e, this.document, { foreground: this.opts.foreground, background: this.opts.background, trueColorByteOrder: this.opts.trueColorByteOrder, contrastMode: this.opts.contrastMode, minColorContrast: this.opts.minColorContrast }), f = xr(u, e, this.document);
        this.drawEntityTracked(Ye(f, l), n + 1);
      }
      return;
    }
    const i = e.insertionPoint;
    if (!L(i)) return this.markSkipped("INSERT");
    const o = this.worldToScreen(i);
    this.beginStyledPath(e);
    const r = 5;
    if (this.ctx.rect(o.x - r, o.y - r, r * 2, r * 2), this.finishStroke(), Array.isArray(e.attribs)) for (const l of e.attribs) this.drawText(l);
  }
  drawSolid(e) {
    var i;
    const n = (i = e.vertices) != null ? i : e.points;
    if (!Array.isArray(n) || n.length < 3) return this.markSkipped(String(e.type));
    this.beginStyledPath(e, true);
    const s = this.worldToScreen(n[0]);
    this.ctx.moveTo(s.x, s.y);
    for (const o of n.slice(1)) {
      if (!L(o)) continue;
      const r = this.worldToScreen(o);
      this.ctx.lineTo(r.x, r.y);
    }
    this.ctx.closePath(), this.finishFillStroke(true);
  }
  drawHatch(e) {
    var s, i;
    const n = e.loops;
    if (!Array.isArray(n) || n.length === 0) return this.markSkipped("HATCH");
    this.beginStyledPath(e, true);
    for (const o of n)
      if ((s = o.commands) != null && s.length) this.addPathCommands(o.commands);
      else if ((i = o.vertices) != null && i.length) {
        const r = this.worldToScreen(o.vertices[0]);
        this.ctx.moveTo(r.x, r.y);
        for (const a of o.vertices.slice(1)) {
          const c = this.worldToScreen(a);
          this.ctx.lineTo(c.x, c.y);
        }
        this.ctx.closePath();
      }
    this.finishFillStroke(!!cn(e, this.document, { foreground: this.opts.foreground, background: this.opts.background, trueColorByteOrder: this.opts.trueColorByteOrder, contrastMode: this.opts.contrastMode, minColorContrast: this.opts.minColorContrast }));
  }
  drawSpline(e) {
    var s;
    const n = (s = e.fitPoints) != null && s.length ? e.fitPoints : e.controlPoints;
    if (!n || n.length < 2) return this.markSkipped("SPLINE");
    this.strokeWorldPolyline(e, n, !!e.isClosed);
  }
  drawPath(e) {
    var n;
    if (!((n = e.commands) != null && n.length)) return this.markSkipped(String(e.type));
    this.beginStyledPath(e, !!e.fillColor), this.addPathCommands(e.commands), this.finishFillStroke(!!e.fillColor);
  }
  addPathCommands(e) {
    for (const n of e)
      if (n.cmd === "M") {
        const s = this.worldToScreen(n.points[0]);
        this.ctx.moveTo(s.x, s.y);
      } else if (n.cmd === "L") {
        const s = this.worldToScreen(n.points[0]);
        this.ctx.lineTo(s.x, s.y);
      } else if (n.cmd === "C") {
        const [s, i, o] = n.points.map((r) => this.worldToScreen(r));
        this.ctx.bezierCurveTo(s.x, s.y, i.x, i.y, o.x, o.y);
      } else if (n.cmd === "Q") {
        const [s, i] = n.points.map((o) => this.worldToScreen(o));
        this.ctx.quadraticCurveTo(s.x, s.y, i.x, i.y);
      } else n.cmd === "Z" && this.ctx.closePath();
  }
  drawImage(e) {
    var f, d;
    const n = e.insertionPoint;
    if (!L(n)) return this.markSkipped(String(e.type));
    const s = Number((f = e.width) != null ? f : 32), i = Number((d = e.height) != null ? d : 32), o = this.worldToScreen(n), r = this.worldToScreen({ x: n.x + s, y: n.y - i }), a = Math.min(o.x, r.x), c = Math.min(o.y, r.y), l = Math.abs(r.x - o.x), h = Math.abs(r.y - o.y), u = e.imageDataUrl;
    if (u) {
      const m = this.getImage(u);
      if (m.complete && m.naturalWidth > 0) {
        this.ctx.save(), this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), this.ctx.drawImage(m, a, c, l, h), this.ctx.restore(), this.stats.drawn++;
        return;
      }
      m.onload = () => this.render();
    }
    if (!this.opts.showImagePlaceholders) return this.markSkipped(String(e.type));
    this.beginStyledPath(e), this.ctx.rect(a, c, l, h), this.ctx.moveTo(a, c), this.ctx.lineTo(a + l, c + h), this.ctx.moveTo(a + l, c), this.ctx.lineTo(a, c + h), this.finishStroke();
  }
  getImage(e) {
    let n = this.imageCache.get(e);
    return n || (n = new Image(), n.src = e, this.imageCache.set(e, n)), n;
  }
  drawUnsupportedMarker(e) {
    const n = this.entityAnchor(e);
    if (!n) return;
    const s = this.worldToScreen(n);
    this.beginStyledPath(e), this.ctx.moveTo(s.x - 4, s.y - 4), this.ctx.lineTo(s.x + 4, s.y + 4), this.ctx.moveTo(s.x + 4, s.y - 4), this.ctx.lineTo(s.x - 4, s.y + 4), this.finishStroke();
  }
  drawTextAt(e, n, s, i, o) {
    var d, m, p, g, b;
    const r = this.ctx, a = this.worldToScreen(n);
    r.save(), r.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), r.translate(a.x, a.y), r.rotate(-o);
    const c = Number((d = e.generationFlag) != null ? d : 0), l = Number((m = e.xScale) != null ? m : 1);
    r.scale((c & 2 ? -1 : 1) * (Number.isFinite(l) && Math.abs(l) > 1e-9 ? Math.abs(l) : 1), c & 4 ? -1 : 1);
    const h = Math.max(4, Math.min(256, Math.abs(i) * this.view.scale));
    r.font = `${h}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, r.fillStyle = $e(e, this.document, { foreground: this.opts.foreground, background: this.opts.background, trueColorByteOrder: this.opts.trueColorByteOrder, contrastMode: this.opts.contrastMode, minColorContrast: this.opts.minColorContrast }), r.globalAlpha = Re(Number((p = e.opacity) != null ? p : 1), 0, 1);
    const u = Number((g = e.halign) != null ? g : 0), f = Number((b = e.valign) != null ? b : 0);
    r.textAlign = u === 1 || u === 4 ? "center" : u === 2 ? "right" : "left", r.textBaseline = f === 1 ? "bottom" : f === 2 ? "middle" : f === 3 ? "top" : "alphabetic";
    for (const [y, v] of s.split(/\r?\n/g).entries()) r.fillText(v, 0, y * h * 1.22);
    r.restore(), this.stats.drawn++;
  }
  strokeWorldPolyline(e, n, s) {
    var a;
    const i = n.filter(L);
    if (i.length < 2) return this.markSkipped(String(e.type));
    const o = fn(e, this.document);
    if (o) {
      const c = Pn(i, s, o), l = [...c.dots];
      this.beginStyledPath(e, false, false);
      for (const [h, u] of c.segments) {
        const f = this.worldToScreen(h), d = this.worldToScreen(u);
        this.ctx.moveTo(f.x, f.y), this.ctx.lineTo(d.x, d.y);
      }
      for (const h of (a = c.markers) != null ? a : []) {
        const u = this.resolveLineTypeGlyph(h);
        if (u) {
          Hl(l, h.fallbackPoint);
          for (const f of wr(h, u)) {
            if (f.length < 2) continue;
            const d = this.worldToScreen(f[0]);
            this.ctx.moveTo(d.x, d.y);
            for (const m of f.slice(1)) {
              const p = this.worldToScreen(m);
              this.ctx.lineTo(p.x, p.y);
            }
          }
        }
      }
      if (this.ctx.stroke(), l.length > 0) {
        this.ctx.setLineDash([]), this.ctx.beginPath();
        const h = Math.max(0.5, this.ctx.lineWidth / 2);
        for (const u of l) {
          const f = this.worldToScreen(u);
          this.ctx.moveTo(f.x + h, f.y), this.ctx.arc(f.x, f.y, h, 0, Math.PI * 2);
        }
        this.ctx.fillStyle = this.ctx.strokeStyle, this.ctx.fill();
      }
      this.ctx.restore(), this.stats.drawn++;
      return;
    }
    this.beginStyledPath(e);
    const r = this.worldToScreen(i[0]);
    this.ctx.moveTo(r.x, r.y);
    for (const c of i.slice(1)) {
      const l = this.worldToScreen(c);
      this.ctx.lineTo(l.x, l.y);
    }
    s && this.ctx.closePath(), this.finishStroke();
  }
  resolveLineTypeGlyph(e) {
    var n;
    return e.kind === "shape" ? this.opts.shxGlyphResolver.resolveShape(Number(e.shapeNumber), e.fontName) : this.opts.shxGlyphResolver.resolveText(String((n = e.text) != null ? n : ""), e.fontName);
  }
  markSkipped(e) {
    var n;
    this.stats.skipped++, this.stats.unsupported[e] = (n = this.stats.unsupported[e]) != null ? n : 0;
  }
  entityAnchor(e) {
    for (const n of ["startPoint", "insertionPoint", "center", "point", "location"]) {
      const s = e[n];
      if (L(s)) return j(s);
    }
    if (Array.isArray(e.vertices) && L(e.vertices[0])) return j(e.vertices[0]);
    if (Array.isArray(e.commands) && e.commands.length) {
      const n = e.commands.find((s) => s.points.length > 0);
      if (n) return j(n.points[0]);
    }
  }
  lookupLayer(e) {
    var n, s;
    if (!(!this.document || !e))
      return (s = (n = this.document.layers[e]) != null ? n : this.document.layers[e.toLowerCase()]) != null ? s : Object.values(this.document.layers).find((i) => i.name.toLowerCase() === e.toLowerCase());
  }
  lookupBlock(e) {
    var n, s;
    if (!(!this.document || !e))
      return (s = (n = this.document.blocks[e]) != null ? n : this.document.blocks[e.toLowerCase()]) != null ? s : Object.values(this.document.blocks).find((i) => i.name.toLowerCase() === e.toLowerCase());
  }
  clampScale(e) {
    return Math.min(this.opts.maxScale, Math.max(this.opts.minScale, e));
  }
  boundsOptions() {
    return { maxInsertDepth: this.opts.maxInsertDepth, maxCurveSegments: this.opts.maxCurveSegments };
  }
  emitViewChange() {
    var e;
    (e = this.onViewChange) == null || e.call(this, {
      view: this.getViewState(),
      fitScale: this.fitScale,
      zoomRatio: this.getZoomRatio(),
      zoomPercent: this.getZoomPercent(),
      bounds: this.getBounds()
    });
  }
};
function Yl(t) {
  return {
    total: t.total,
    drawn: t.drawn,
    skipped: t.skipped,
    byType: { ...t.byType },
    unsupported: { ...t.unsupported },
    renderElapsedMs: t.renderElapsedMs,
    backend: t.backend,
    primitiveCount: t.primitiveCount,
    visiblePrimitiveCount: t.visiblePrimitiveCount,
    culledPrimitiveCount: t.culledPrimitiveCount,
    gpuMemoryBytes: t.gpuMemoryBytes,
    buildElapsedMs: t.buildElapsedMs
  };
}
function Hl(t, e) {
  const n = Math.max(1, Math.abs(e.x), Math.abs(e.y)), s = Math.max(1e-9, n * 1e-12), i = t.findIndex((o) => Math.hypot(o.x - e.x, o.y - e.y) <= s);
  i >= 0 && t.splice(i, 1);
}
function Mh(t, e, n, s = {}) {
  const i = t && typeof t == "object" ? t : {}, o = mh(i, s), r = uh(i), a = ph(i, s, r), c = vh(i, s), l = dh(i.header, n), h = hh(a), u = gh(i, l), f = u.view, d = ih(i), m = oh(i, d), p = ah(i), g = ch(i), b = Array.isArray(i.entities) ? i.entities : [], y = { keepRaw: !!s.keepRaw, includeUnknownProperties: !!s.keepRaw }, v = b.filter((C) => !!C && typeof C == "object").map((C) => Nr(C, y)), x = pn({
    format: "dwg",
    sourceName: e,
    header: l,
    layers: o,
    lineTypes: a,
    blocks: c,
    entities: v,
    savedView: f,
    dictionaries: d,
    xrecords: m,
    dataLinks: p,
    dataTables: g,
    metadata: {
      parser: "@mlightcad/libredwg-web",
      parserMode: "wasm",
      version: n,
      savedView: f,
      requiredShxFonts: h,
      businessData: {
        dictionaries: d.length,
        xrecords: m.length,
        dataLinks: p.length,
        dataTables: g.length
      }
    },
    warnings: u.warning ? [u.warning] : [],
    raw: s.keepRaw ? t : void 0
  });
  if (v.length === 0 && x.warnings.push("DWG parsed successfully but no model-space entities were exposed by the converter. Check layout/paper-space content or unsupported proxy objects."), [...new Set(Object.values(a))].some((C) => C.pattern.some((N) => {
    var B;
    return Number((B = N.elementTypeFlag) != null ? B : 0) !== 0;
  }))) {
    const C = h.length > 0 ? ` This drawing references external shape font${h.length === 1 ? "" : "s"} ${h.join(", ")}, whose outlines are not embedded in the DWG.` : "";
    x.warnings.push(`Complex SHX linetype glyphs are preserved in the normalized LTYPE definition and rendered as a dash/dot approximation.${C}`);
  }
  return x;
}
function le(t) {
  var e, n, s, i;
  if (typeof t == "bigint") return t.toString(16).toLocaleUpperCase();
  if (typeof t == "number" && Number.isFinite(t)) return Math.trunc(t).toString(16).toLocaleUpperCase();
  if (typeof t == "string") return t.trim() || void 0;
  if (Array.isArray(t)) return le((e = t[3]) != null ? e : t[2]);
  if (t && typeof t == "object") {
    const o = t;
    return le((i = (s = (n = o.absolute_ref) != null ? n : o.absoluteRef) != null ? s : o.value) != null ? i : o.handle);
  }
}
function ih(t) {
  var o, r;
  const e = t.objects && typeof t.objects == "object" ? t.objects : void 0, n = [e == null ? void 0 : e.DICTIONARY, e == null ? void 0 : e.dictionary, t.dictionaries], s = [], i = /* @__PURE__ */ new Set();
  for (const a of n)
    for (const c of Ot(a)) {
      if (!c || typeof c != "object") continue;
      const l = c, h = le((o = l.handle) != null ? o : l.id);
      if (h && i.has(h.toLocaleUpperCase())) continue;
      const u = [];
      if (l.entries && typeof l.entries == "object" && !Array.isArray(l.entries))
        for (const [f, d] of Object.entries(l.entries)) {
          const m = le(d);
          f && m && u.push({ name: f, handle: m });
        }
      else if (Array.isArray(l.texts) && Array.isArray(l.itemhandles))
        for (let f = 0; f < Math.min(l.texts.length, l.itemhandles.length); f += 1) {
          const d = E(l.texts[f]), m = le(l.itemhandles[f]);
          d && m && u.push({ name: d, handle: m });
        }
      s.push({ handle: h, ownerHandle: le((r = l.ownerHandle) != null ? r : l.owner), entries: u }), h && i.add(h.toLocaleUpperCase());
    }
  return s;
}
function oh(t, e) {
  var r, a, c;
  const n = t.objects && typeof t.objects == "object" ? t.objects : void 0, s = [n == null ? void 0 : n.XRECORD, n == null ? void 0 : n.xrecords, t.xrecords], i = [], o = /* @__PURE__ */ new Set();
  for (const l of s)
    for (const h of Ot(l)) {
      if (!h || typeof h != "object") continue;
      const u = h, f = le((r = u.handle) != null ? r : u.id);
      if (f && o.has(f.toLocaleUpperCase())) continue;
      const d = (Array.isArray(u.data) ? u.data : Array.isArray(u.entries) ? u.entries : []).flatMap((g) => {
        var x, w, C;
        const b = g && typeof g == "object" ? g : void 0, y = me((w = (x = b == null ? void 0 : b.value) != null ? x : b == null ? void 0 : b.data) != null ? w : g);
        if (y === void 0) return [];
        const v = k((C = b == null ? void 0 : b.code) != null ? C : b == null ? void 0 : b.groupCode);
        return [{ ...v !== void 0 ? { code: v } : {}, value: y }];
      }), m = le((a = u.ownerHandle) != null ? a : u.owner), p = rh(f, m, e);
      i.push({
        handle: f,
        ownerHandle: m,
        entryName: (c = E(u.entryName)) != null ? c : p.entryName,
        dictionaryPath: Array.isArray(u.dictionaryPath) ? u.dictionaryPath.map(String) : p.path,
        extensionDictionary: le(u.extensionDictionary),
        cloning: k(u.cloning),
        data: d
      }), f && o.add(f.toLocaleUpperCase());
    }
  return i;
}
function rh(t, e, n) {
  var l, h;
  if (!t) return {};
  const s = new Map(n.filter((u) => u.handle).map((u) => [u.handle.toLocaleUpperCase(), u])), i = e ? s.get(e.toLocaleUpperCase()) : void 0, o = (l = i == null ? void 0 : i.entries.find((u) => u.handle.toLocaleUpperCase() === t.toLocaleUpperCase())) == null ? void 0 : l.name;
  if (!i) return { entryName: o };
  const r = o ? [o] : [];
  let a = i;
  const c = /* @__PURE__ */ new Set();
  for (; a.handle && a.ownerHandle && !c.has(a.handle.toLocaleUpperCase()); ) {
    c.add(a.handle.toLocaleUpperCase());
    const u = s.get(a.ownerHandle.toLocaleUpperCase());
    if (!u) break;
    const f = (h = u.entries.find((d) => d.handle.toLocaleUpperCase() === a.handle.toLocaleUpperCase())) == null ? void 0 : h.name;
    f && r.unshift(f), a = u;
  }
  return { entryName: o, path: r.length > 0 ? r : void 0 };
}
function ah(t) {
  var i, o, r, a, c, l, h, u, f;
  const e = t.objects && typeof t.objects == "object" ? t.objects : void 0, n = [], s = /* @__PURE__ */ new Set();
  for (const d of Ot((o = (i = e == null ? void 0 : e.DATALINK) != null ? i : e == null ? void 0 : e.dataLinks) != null ? o : t.dataLinks)) {
    if (!d || typeof d != "object") continue;
    const m = d, p = le((r = m.handle) != null ? r : m.id);
    p && s.has(p.toLocaleUpperCase()) || (n.push({
      handle: p,
      dataAdapter: E((a = m.dataAdapter) != null ? a : m.data_adapter),
      description: E(m.description),
      tooltip: E(m.tooltip),
      connectionString: E((c = m.connectionString) != null ? c : m.connection_string),
      updateStatus: E((l = m.updateStatus) != null ? l : m.update_status),
      updateOption: k((h = m.updateOption) != null ? h : m.update_option),
      pathOption: k((u = m.pathOption) != null ? u : m.path_option),
      lastUpdated: E((f = m.lastUpdated) != null ? f : m.last_updated)
    }), p && s.add(p.toLocaleUpperCase()));
  }
  return n;
}
function ch(t) {
  var o, r, a, c, l, h, u, f, d, m, p, g, b, y, v, x, w, C, N, B;
  const e = t.objects && typeof t.objects == "object" ? t.objects : void 0, n = [e == null ? void 0 : e.DATATABLE, e == null ? void 0 : e.dataTables, t.dataTables, e == null ? void 0 : e.TABLECONTENT], s = [], i = /* @__PURE__ */ new Set();
  for (const D of n)
    for (const I of Ot(D)) {
      if (!I || typeof I != "object") continue;
      const P = I, M = le((o = P.handle) != null ? o : P.id);
      if (M && i.has(M.toLocaleUpperCase())) continue;
      const T = He((r = P.linkedData) != null ? r : P.ldata), A = He((a = P.linkedTableData) != null ? a : P.tdata), F = lh((c = P.columns) != null ? c : P.cols, A), _ = Math.max(
        0,
        Math.trunc((d = k((f = (u = (h = (l = P.rowCount) != null ? l : P.numRows) != null ? h : P.num_rows) != null ? u : A == null ? void 0 : A.numRows) != null ? f : A == null ? void 0 : A.num_rows)) != null ? d : 0),
        ...F.map((R) => R.values.length)
      ), X = Math.max(
        F.length,
        Math.trunc((x = k((v = (y = (b = (g = (p = (m = P.columnCount) != null ? m : P.numColumns) != null ? p : P.numCols) != null ? g : P.num_cols) != null ? b : A == null ? void 0 : A.numColumns) != null ? y : A == null ? void 0 : A.numCols) != null ? v : A == null ? void 0 : A.num_cols)) != null ? x : 0)
      );
      F.length === 0 && _ === 0 && X === 0 || (s.push({
        handle: M,
        name: E((B = (N = (C = (w = P.tableName) != null ? w : P.table_name) != null ? C : P.name) != null ? N : T == null ? void 0 : T.name) != null ? B : T == null ? void 0 : T.description),
        rowCount: _,
        columnCount: X,
        columns: F
      }), M && i.add(M.toLocaleUpperCase()));
    }
  return s;
}
function lh(t, e) {
  const n = Array.isArray(t) ? t : Array.isArray(e == null ? void 0 : e.columns) ? e.columns : Array.isArray(e == null ? void 0 : e.cols) ? e.cols : [];
  if (n.length > 0)
    return n.map((r, a) => {
      var h, u, f;
      const c = He(r), l = Array.isArray(c == null ? void 0 : c.rows) ? c.rows : Array.isArray(c == null ? void 0 : c.values) ? c.values : [];
      return {
        name: (u = E((h = c == null ? void 0 : c.name) != null ? h : c == null ? void 0 : c.text)) != null ? u : `Column ${a + 1}`,
        type: (f = E(c == null ? void 0 : c.type)) != null ? f : k(c == null ? void 0 : c.type),
        values: l.map(Ao).filter((d) => d !== void 0)
      };
    });
  const i = (Array.isArray(e == null ? void 0 : e.rows) ? e.rows : []).map((r) => {
    const a = He(r);
    return Array.isArray(a == null ? void 0 : a.cells) ? a.cells : [];
  }), o = Math.max(0, ...i.map((r) => r.length));
  return Array.from({ length: o }, (r, a) => ({
    name: `Column ${a + 1}`,
    values: i.map((c) => Ao(c[a])).filter((c) => c !== void 0)
  }));
}
function Ao(t) {
  var o, r;
  const e = He(t), n = Array.isArray(e == null ? void 0 : e.cellContents) ? e.cellContents : Array.isArray(e == null ? void 0 : e.cell_contents) ? e.cell_contents : void 0, s = (r = (o = n == null ? void 0 : n[0]) != null ? o : e == null ? void 0 : e.value) != null ? r : t, i = He(s);
  for (const a of [i == null ? void 0 : i.valueString, i == null ? void 0 : i.value_string, i == null ? void 0 : i.dataString, i == null ? void 0 : i.data_string, i == null ? void 0 : i.dataLong, i == null ? void 0 : i.data_long, i == null ? void 0 : i.dataDouble, i == null ? void 0 : i.data_double, i == null ? void 0 : i.dataDate, i == null ? void 0 : i.data_date, i == null ? void 0 : i.dataPoint, i == null ? void 0 : i.data_point, i == null ? void 0 : i.data3dPoint, i == null ? void 0 : i.data_3dpoint, s]) {
    const c = me(a);
    if (c != null && c !== "" && !(typeof c == "object" && !Array.isArray(c) && Object.keys(c).length === 0)) return c;
  }
}
function Ot(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t != "object") return [];
  const e = t;
  for (const n of ["entries", "records", "items", "values"]) if (Array.isArray(e[n])) return e[n];
  return Object.values(e).filter((n) => n && typeof n == "object");
}
function He(t) {
  return t && typeof t == "object" && !Array.isArray(t) ? t : void 0;
}
function hh(t) {
  var n;
  const e = /* @__PURE__ */ new Set();
  for (const s of new Set(Object.values(t)))
    for (const i of s.pattern)
      Number((n = i.elementTypeFlag) != null ? n : 0) !== 0 && i.fontName && e.add(i.fontName);
  return [...e].sort((s, i) => s.localeCompare(i));
}
function uh(t) {
  var o, r, a, c;
  const e = t.tables, n = [t.STYLE, t.styles, e == null ? void 0 : e.STYLE, e == null ? void 0 : e.styles], s = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set();
  for (const l of n)
    for (const h of pt(l)) {
      if (!h || typeof h != "object") continue;
      const u = h, f = E((r = (o = u.font) != null ? o : u.fontFileName) != null ? r : u.primaryFontFileName);
      if (!f || !/\.shx$/i.test(f)) continue;
      (((c = k((a = u.standardFlag) != null ? a : u.flag)) != null ? c : 0) & 1) === 1 && i.add(f);
      for (const m of [u.handle, u.id, u.name]) {
        const p = Pr(m);
        p && s.set(p, f);
      }
    }
  return { byReference: s, shapeFonts: [...i] };
}
function Nr(t, e) {
  var a, c, l, h, u, f, d, m;
  const n = ut(t, void 0, { ...e, numericColorMode: "rgb" }), s = k(t.color);
  s !== void 0 && s >= 0 && s <= 16777215 && (n.color = s, n.trueColor = s), n.colorIndex = (l = k((c = (a = t.colorIndex) != null ? a : t.colorNumber) != null ? c : t.aci)) != null ? l : n.colorIndex, n.colorName = (u = E((h = t.colorName) != null ? h : t.color_name)) != null ? u : n.colorName;
  const i = k((f = t.flag) != null ? f : t.flags);
  i !== void 0 && (n.flag = i);
  const o = String((m = (d = t.type) != null ? d : t.entityType) != null ? m : "").toUpperCase(), r = /^(POLYLINE|POLYLINE_2D|POLYLINE2D|POLYLINE_3D|POLYLINE3D)$/.test(o);
  return (t.isClosed === true || t.closed === true || r && (Number(i != null ? i : 0) & 1) === 1 || o === "LWPOLYLINE" && (Number(i != null ? i : 0) & 512) === 512) && (n.isClosed = true), n;
}
function fh(t) {
  return typeof t == "number" && Number.isFinite(t) && Math.abs(Math.trunc(t)) >= 1 && Math.abs(Math.trunc(t)) <= 255;
}
function dh(t, e) {
  const n = t && typeof t == "object" ? { ...t } : {};
  return e && (n.dwgVersion = e), n;
}
function mh(t, e) {
  var o, r, a, c, l, h, u, f, d, m, p, g, b, y, v, x;
  const n = {}, s = [], i = t.tables;
  for (const w of ["LAYER", "layer", "layers"]) {
    const C = (o = t[w]) != null ? o : i == null ? void 0 : i[w];
    C && s.push(C);
  }
  for (const w of s)
    for (const C of pt(w)) {
      const N = C, B = E((a = (r = N.name) != null ? r : N.layerName) != null ? a : N.entryName);
      if (!B) continue;
      const D = k((c = N.colorIndex) != null ? c : N.colorNumber), I = k((m = (d = (f = (u = (h = (l = N.trueColor) != null ? l : N.true_color) != null ? h : N.truecolor) != null ? u : N.colorRGB) != null ? f : N.colorRgb) != null ? d : N.rgbColor) != null ? m : N.rgb), P = k(N.color), M = fh(D), T = I != null ? I : !M && P !== void 0 && P >= 0 && P <= 16777215 ? P : void 0, A = {
        name: B,
        color: M ? void 0 : (p = N.color) != null ? p : N.colorName,
        colorIndex: D != null ? D : P !== void 0 && Math.abs(P) <= 257 ? P : void 0,
        trueColor: T,
        lineType: E((g = N.lineType) != null ? g : N.linetype),
        lineweight: k((b = N.lineweight) != null ? b : N.lineWeight),
        isVisible: !(N.isVisible === false || N.off === true || Number((y = D != null ? D : N.color) != null ? y : 1) < 0),
        isFrozen: !!((v = N.isFrozen) != null ? v : N.frozen),
        isLocked: !!((x = N.isLocked) != null ? x : N.locked),
        raw: e.keepRaw ? N : void 0
      };
      Jt(n, A);
    }
  return n;
}
function ph(t, e, n) {
  var r, a, c, l;
  const s = {}, i = t.tables, o = [t.LTYPE, t.ltype, t.lineTypes, i == null ? void 0 : i.LTYPE, i == null ? void 0 : i.ltype, i == null ? void 0 : i.lineTypes];
  for (const h of o)
    for (const u of pt(h)) {
      const f = u, d = E((a = (r = f.name) != null ? r : f.lineTypeName) != null ? a : f.entryName);
      if (!d) continue;
      const p = (Array.isArray(f.pattern) ? f.pattern : Array.isArray(f.dashes) ? f.dashes : []).flatMap((g) => {
        var D, I, P, M, T, A, F;
        if (typeof g == "number") return [{ length: g }];
        if (!g || typeof g != "object") return [];
        const b = g, y = k((I = (D = b.elementLength) != null ? D : b.length) != null ? I : b.dashLength);
        if (y === void 0) return [];
        const v = k(b.elementTypeFlag), x = k(b.shapeNumber), w = v !== void 0 && x !== void 0, C = w ? x : k((P = b.typeFlag) != null ? P : b.elementTypeFlag), N = E((T = (M = b.styleObjectId) != null ? M : b.styleHandle) != null ? T : b.style), B = (A = N ? n.byReference.get(Pr(N)) : void 0) != null ? A : (Number(C != null ? C : 0) & 4) === 4 && n.shapeFonts.length === 1 ? n.shapeFonts[0] : void 0;
        return [{
          length: y,
          elementTypeFlag: C,
          shapeNumber: w ? v : k((F = b.shapeCode) != null ? F : b.shapeNumber),
          scale: k(b.scale),
          rotation: k(b.rotation),
          offsetX: k(b.offsetX),
          offsetY: k(b.offsetY),
          text: E(b.text),
          styleHandle: N,
          fontName: B
        }];
      });
      zr(s, {
        name: d,
        handle: E((c = f.handle) != null ? c : f.id),
        description: E(f.description),
        totalPatternLength: k((l = f.totalPatternLength) != null ? l : f.patternLength),
        pattern: p,
        raw: e.keepRaw ? f : void 0
      });
    }
  return s;
}
function Pr(t) {
  return String(t != null ? t : "").trim().replace(/^0x/i, "").replace(/^0+(?=[0-9a-f])/i, "").toLowerCase();
}
function gh(t, e) {
  var b, y, v, x, w, C, N, B, D, I, P, M, T, A, F, _, X, R, O, W;
  const n = t.tables, i = pt((v = (y = (b = t.VPORT) != null ? b : t.vports) != null ? y : n == null ? void 0 : n.VPORT) != null ? v : n == null ? void 0 : n.vports).filter((H) => !!H && typeof H == "object").find((H) => {
    var G;
    return String((G = H.name) != null ? G : "").trim().toLowerCase() === "*active";
  }), o = i ? "vport" : "header-ucs", r = i != null ? i : e, a = V((w = (x = r.ucsOrigin) != null ? x : r.UCSORG) != null ? w : e.UCSORG), c = V((N = (C = r.ucsXAxis) != null ? C : r.UCSXDIR) != null ? N : e.UCSXDIR), l = V((D = (B = r.ucsYAxis) != null ? B : r.UCSYDIR) != null ? D : e.UCSYDIR), h = (M = k((P = (I = r.viewTwistAngle) != null ? I : r.twistAngle) != null ? P : r.VIEWTWIST)) != null ? M : 0, u = V((F = (A = (T = r.viewDirectionFromTarget) != null ? T : r.viewDirection) != null ? A : r.direction) != null ? F : r.VIEWDIR), f = !xh(a, c, l);
  if (!(!!i || !!u || f || Math.abs(h) > 1e-12)) return {};
  const m = yh(u), p = m ? bh(a, c, l, h) : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, g = {
    source: o,
    name: E(r.name),
    handle: E(r.handle),
    center: V((_ = r.center) != null ? _ : r.VIEWCTR),
    target: V((R = (X = r.viewTarget) != null ? X : r.target) != null ? R : r.TARGET),
    direction: u,
    viewHeight: k((W = (O = r.viewHeight) != null ? O : r.height) != null ? W : r.VIEWSIZE),
    aspectRatio: k(r.aspectRatio),
    twistAngle: h,
    ucsOrigin: a,
    ucsXAxis: c,
    ucsYAxis: l,
    sceneTransformApplied: m,
    sceneTransform: p
  };
  return m ? { view: g } : {
    view: g,
    warning: "The saved CAD view has a missing, non-finite, or tilted VIEWDIR. File Viewer kept world coordinates instead of applying an unsafe 2D UCS/PLAN rotation."
  };
}
function bh(t, e, n, s) {
  var l, h, u;
  const i = (l = Kt(e)) != null ? l : { x: 1, y: 0 }, o = (h = Kt(n)) != null ? h : { x: -i.y, y: i.x }, r = i.x * o.x + i.y * o.y, a = (u = Kt({
    x: o.x - i.x * r,
    y: o.y - i.y * r
  })) != null ? u : { x: -i.y, y: i.x }, c = {
    a: i.x,
    b: a.x,
    c: i.y,
    d: a.y,
    e: t ? -(t.x * i.x + t.y * i.y) : 0,
    f: t ? -(t.x * a.x + t.y * a.y) : 0
  };
  return Tt(fr(Number.isFinite(s) ? s : 0), c);
}
function Kt(t) {
  var n;
  if (!t || Math.abs(Number((n = t.z) != null ? n : 0)) > 1e-6) return;
  const e = Math.hypot(t.x, t.y);
  if (!(!Number.isFinite(e) || e < 1e-12))
    return { x: t.x / e, y: t.y / e };
}
function yh(t) {
  if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) return false;
  const e = Math.hypot(t.x, t.y, Number(t.z));
  return !Number.isFinite(e) || e < 1e-12 ? false : Math.hypot(t.x, t.y) / e <= 1e-4 && Math.abs(Number(t.z)) / e >= 1 - 1e-8;
}
function xh(t, e, n) {
  var a, c, l;
  const s = (h, u) => Number.isFinite(h) && Math.abs(Number(h) - u) <= 1e-10, i = !t || s(t.x, 0) && s(t.y, 0) && s((a = t.z) != null ? a : 0, 0), o = !e || s(e.x, 1) && s(e.y, 0) && s((c = e.z) != null ? c : 0, 0), r = !n || s(n.x, 0) && s(n.y, 1) && s((l = n.z) != null ? l : 0, 0);
  return i && o && r;
}
function vh(t, e) {
  var r, a, c, l;
  const n = {}, s = [t.blocks, t.blockHeaders, t.block_records, t.blockRecords], i = t.tables;
  s.push(i == null ? void 0 : i.BLOCK, i == null ? void 0 : i.BLOCK_RECORD, i == null ? void 0 : i.blocks);
  const o = { keepRaw: !!e.keepRaw, includeUnknownProperties: !!e.keepRaw };
  for (const h of s)
    for (const u of pt(h)) {
      const f = u, d = E((a = (r = f.name) != null ? r : f.blockName) != null ? a : f.name2);
      if (!d) continue;
      const p = (Array.isArray(f.entities) ? f.entities : Array.isArray(f.ownedObjects) ? f.ownedObjects : []).filter((g) => !!g && typeof g == "object").map((g) => Nr(g, o));
      Do(n, {
        name: d,
        basePoint: (l = V((c = f.basePoint) != null ? c : f.origin)) != null ? l : { x: 0, y: 0 },
        entities: p,
        raw: e.keepRaw ? f : void 0
      });
    }
  return n;
}
function pt(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t != "object") return [];
  const e = t, n = Object.values(e).filter((i) => i && typeof i == "object"), s = ["entries", "records", "items", "values", "layers", "blocks"].flatMap((i) => Array.isArray(e[i]) ? e[i] : []);
  return s.length > 0 ? s : n;
}
export {
  yo as CadCanvasRenderer,
  Io as cadEntityWorldStrokeWidth,
  dr as computeCadDocumentBounds,
  Mh as normalizeDwgDatabase,
  $e as resolveCadColor
};
