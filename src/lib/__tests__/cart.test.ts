import {
  addToCart,
  changeQty,
  removeLine,
  cartTotal,
  cartItemCount,
  type CartLine,
  type ProductLike,
} from "@/lib/cart";

const coca: ProductLike = {
  id: "p1",
  name: "Coca-Cola 600ml",
  category: "refresco",
  price: 22,
  stock: 5,
};
const jarritos: ProductLike = {
  id: "p2",
  name: "Jarritos 2 LT Tamarindo",
  category: "refresco",
  price: 28,
  stock: 3,
};
const sinStock: ProductLike = { ...coca, id: "p3", stock: 0 };

describe("addToCart — agregar productos al carrito", () => {
  test("TU-05 — agrega un producto nuevo al carrito vacío", () => {
    const r = addToCart([], coca);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cart).toHaveLength(1);
      expect(r.cart[0]).toMatchObject({ productId: "p1", qty: 1, price: 22 });
    }
  });

  test("TU-06 — incrementa la cantidad si el producto ya está en el carrito", () => {
    const r1 = addToCart([], coca);
    if (!r1.ok) throw new Error("setup falló");
    const r2 = addToCart(r1.cart, coca);
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.cart).toHaveLength(1);
      expect(r2.cart[0].qty).toBe(2);
    }
  });

  test("TU-07 — rechaza productos con stock cero", () => {
    const r = addToCart([], sinStock);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("out_of_stock");
      expect(r.available).toBe(0);
    }
  });

  test("TU-08 — rechaza cuando se excede el stock disponible", () => {
    let cart: CartLine[] = [];
    // Acumulamos hasta el límite (stock = 3 de Jarritos)
    for (let i = 0; i < 3; i++) {
      const r = addToCart(cart, jarritos);
      if (!r.ok) throw new Error(`fallo a la iteración ${i}`);
      cart = r.cart;
    }
    // El cuarto intento debe ser rechazado
    const fourth = addToCart(cart, jarritos);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.reason).toBe("exceeds_stock");
      expect(fourth.available).toBe(3);
    }
  });
});

describe("changeQty — modificar cantidad de una línea", () => {
  test("TU-09 — disminuir a cero remueve la línea del carrito", () => {
    const r1 = addToCart([], coca);
    if (!r1.ok) throw new Error("setup falló");
    const r2 = changeQty(r1.cart, "p1", -1, 5);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.cart).toHaveLength(0);
  });

  test("TU-09b — incrementar más allá del stock falla con razón clara", () => {
    const r1 = addToCart([], jarritos); // qty 1, stock 3
    if (!r1.ok) throw new Error("setup falló");
    // Tratar de subir directamente 5 a una línea con qty 1 y stock 3
    const r2 = changeQty(r1.cart, "p2", 5, 3);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("exceeds_stock");
  });
});

describe("cartTotal y cartItemCount — totales del carrito", () => {
  test("TU-10 — total = suma de price × qty de todas las líneas", () => {
    const cart: CartLine[] = [
      { productId: "p1", name: "Coca", category: "refresco", price: 22, qty: 2 },
      { productId: "p2", name: "Jarritos", category: "refresco", price: 28, qty: 1 },
    ];
    expect(cartTotal(cart)).toBe(72);
  });

  test("TU-11 — items = suma de cantidades de todas las líneas", () => {
    const cart: CartLine[] = [
      { productId: "p1", name: "Coca", category: "refresco", price: 22, qty: 2 },
      { productId: "p2", name: "Jarritos", category: "refresco", price: 28, qty: 3 },
    ];
    expect(cartItemCount(cart)).toBe(5);
  });

  test("TU-11b — carrito vacío reporta total e items en cero", () => {
    expect(cartTotal([])).toBe(0);
    expect(cartItemCount([])).toBe(0);
  });
});

describe("removeLine — quitar una línea por id", () => {
  test("TU-12 — elimina la línea correcta y conserva las demás", () => {
    const cart: CartLine[] = [
      { productId: "p1", name: "Coca", category: "refresco", price: 22, qty: 1 },
      { productId: "p2", name: "Jarritos", category: "refresco", price: 28, qty: 1 },
    ];
    const after = removeLine(cart, "p1");
    expect(after).toHaveLength(1);
    expect(after[0].productId).toBe("p2");
  });
});
