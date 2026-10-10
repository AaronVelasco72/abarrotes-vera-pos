import { barcodeKey, barcodeVariants, cleanBarcode, indexByBarcode, sameBarcode } from "@/lib/barcode";

describe("barcode — normalización y detección de duplicados", () => {
  test("cleanBarcode quita espacios y caracteres no numéricos", () => {
    expect(cleanBarcode(" 7501055 300075\n")).toBe("7501055300075");
  });

  test("UPC-A y su EAN-13 con 0 inicial son el mismo producto", () => {
    expect(sameBarcode("049000028911", "0049000028911")).toBe(true);
    expect(barcodeKey("0049000028911")).toBe("49000028911");
  });

  test("códigos distintos no coinciden y vacío nunca coincide", () => {
    expect(sameBarcode("7501055300075", "7501055300082")).toBe(false);
    expect(sameBarcode("", "")).toBe(false);
    expect(sameBarcode(undefined, "000")).toBe(false);
  });

  test("barcodeVariants incluye las formas con ceros a la izquierda", () => {
    const v = barcodeVariants("049000028911");
    expect(v).toEqual(expect.arrayContaining(["049000028911", "0049000028911", "00049000028911", "49000028911"]));
    expect(v.length).toBeLessThanOrEqual(6);
  });

  test("indexByBarcode encuentra el producto por cualquier variante", () => {
    const idx = indexByBarcode([{ id: "a", barcode: "0049000028911" }, { id: "b", barcode: undefined }]);
    expect(idx.get(barcodeKey("049000028911"))?.id).toBe("a");
    expect(idx.size).toBe(1);
  });
});
