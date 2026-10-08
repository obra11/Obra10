"""Converte um DWG em PDF com aspose-cad e informa a escala do modelo.

A primeira página é o espaço do modelo, ajustada à folha sem deformar.
A distância em pontos do PDF, multiplicada por unitsPerPoint, volta à unidade do arquivo.
"""
import json
import os
import re
import sys
from pathlib import Path


def apply_license() -> None:
    """Aplica a licença da Aspose se o arquivo .lic existir. Sem ele, a biblioteca carimba o PDF."""
    from aspose.cad import License

    candidates = []
    configured = os.environ.get("ASPOSE_CAD_LICENSE", "").strip()
    if configured:
        candidates.append(Path(configured))
    folder = Path(__file__).resolve().parent
    candidates.extend([folder / "Aspose.CAD.lic", folder / "aspose.lic"])
    license_file = next((path for path in candidates if path.is_file()), None)
    if not license_file:
        return
    License().set_license(str(license_file))


def as_cad(image):
    try:
        import aspose.pycore as pycore
        from aspose.cad.fileformats.cad import CadImage
        return pycore.as_of(image, CadImage)
    except Exception:
        return image


def unit_label(image) -> str:
    try:
        from aspose.cad.imageoptions import UnitType
        unit = image.unit_type
        pairs = (
            (UnitType.MILLIMETER, "mm"),
            (UnitType.CENTIMENTER, "cm"),
            (UnitType.METER, "m"),
            (UnitType.KILOMETER, "km"),
            (UnitType.DECIMETER, "dm"),
            (UnitType.INCH, "in"),
            (UnitType.FOOT, "ft"),
            (UnitType.UNITLESS, "un"),
        )
        for candidate, label in pairs:
            if unit == candidate:
                return label
    except Exception:
        return "un"
    return "un"


def extents(image):
    try:
        minimum = image.min_point
        maximum = image.max_point
        width = abs(float(maximum.x) - float(minimum.x))
        height = abs(float(maximum.y) - float(minimum.y))
    except Exception:
        return None
    if width < 1e-9 or height < 1e-9 or width > 1e12 or height > 1e12:
        return None
    return width, height


def layout_names(image):
    layouts = getattr(image, "layouts", None)
    if layouts is None:
        return []
    for read in (lambda: layouts.get_keys(), lambda: layouts.keys()):
        try:
            names = [str(name) for name in list(read()) if str(name)]
            if names:
                return names
        except Exception:
            continue
    return []


def page_size(model_w: float, model_h: float):
    longest = 2400.0
    if model_w >= model_h:
        return longest, max(200.0, longest * model_h / model_w)
    return max(200.0, longest * model_w / model_h), longest


def media_box(path: str):
    data = open(path, "rb").read()
    match = re.search(
        br"/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]",
        data,
    )
    if not match:
        return None
    x0, y0, x1, y1 = (float(item) for item in match.groups())
    width, height = abs(x1 - x0), abs(y1 - y0)
    if width < 1 or height < 1:
        return None
    return width, height


def save_pdf(image, dst: str, use_layouts: bool):
    from aspose.cad.fileformats.cad import CadLayoutDictionary
    from aspose.cad.imageoptions import CadRasterizationOptions, PdfOptions

    size = extents(image)
    page_w, page_h = page_size(*size) if size else (1600.0, 1600.0)
    raster = CadRasterizationOptions()
    raster.page_width = page_w
    raster.page_height = page_h
    raster.automatic_layouts_scaling = True
    try:
        raster.zoom = 1
        raster.border_x = 0
        raster.border_y = 0
        from aspose.cad.imageoptions import Margins
        margins = Margins()
        margins.left = margins.right = margins.top = margins.bottom = 0
        raster.margins = margins
    except Exception:
        pass
    model_first = False
    if use_layouts:
        model = "Model"
        try:
            model = str(CadLayoutDictionary.MODEL_SPACE_NAME or "Model")
        except Exception:
            model = "Model"
        names = layout_names(image)
        ordered = []
        preferred = model if model in names else next((name for name in names if name.lower() in ("model", "modelo")), "")
        if preferred:
            ordered.append(preferred)
            model_first = True
        for name in names:
            if name not in ordered:
                ordered.append(name)
        if ordered:
            raster.layouts = ordered
        elif not names:
            model_first = True
    pdf = PdfOptions()
    pdf.vector_rasterization_options = raster
    image.save(dst, pdf)
    return size, model_first


def scale_payload(label: str, size, dst: str, model_first: bool):
    if not size or not model_first:
        return None
    model_w, model_h = size
    box = media_box(dst) or page_size(model_w, model_h)
    points_per_unit = min(box[0] / model_w, box[1] / model_h)
    if points_per_unit <= 0:
        return None
    return {"unit": label, "unitsPerPoint": 1.0 / points_per_unit, "modelPage": 1}


def main() -> int:
    if len(sys.argv) != 3:
        print("Uso: dwg_to_pdf.py entrada.dwg saida.pdf", file=sys.stderr)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    try:
        from aspose.cad import Image
    except Exception as exc:
        print(
            "Biblioteca aspose-cad não está instalada. No servidor: pip install -r python/requirements.txt",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 3

    apply_license()
    image = as_cad(Image.load(src))
    label = unit_label(image)
    size = extents(image)
    model_first = False
    try:
        _, model_first = save_pdf(image, dst, True)
    except Exception as first_error:
        try:
            image = as_cad(Image.load(src))
            _, model_first = save_pdf(image, dst, False)
            model_first = False
        except Exception:
            print(str(first_error), file=sys.stderr)
            return 4
    payload = scale_payload(label, size, dst, model_first)
    if payload:
        print("OBRA10_SCALE " + json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
