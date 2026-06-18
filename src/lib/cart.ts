import type { CategoryKey } from "./categories";

export type CartLine = {
  productId: string;
  name: string;
  category: CategoryKey;
  price: number;
  qty: number;
};

export type ProductLike = {
  id: string;
  name: string;
  category: CategoryKey;
  price: number;
  stock: number;
};

export type CartResult =
  | { ok: true; cart: CartLine[] }
  | { ok: false; reason: "out_of_stock" | "exceeds_stock"; available: number };

export function addToCart(cart: CartLine[], product: ProductLike): CartResult {
  if (product.stock <= 0) {
    return { ok: false, reason: "out_of_stock", available: 0 };
  }
  const existing = cart.find((l) => l.productId === product.id);
  const newQty = (existing?.qty ?? 0) + 1;
  if (newQty > product.stock) {
    return { ok: false, reason: "exceeds_stock", available: product.stock };
  }
  if (existing) {
    return {
      ok: true,
      cart: cart.map((l) =>
        l.productId === product.id ? { ...l, qty: newQty } : l,
      ),
    };
  }
  return {
    ok: true,
    cart: [
      ...cart,
      {
        productId: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        qty: 1,
      },
    ],
  };
}

export function changeQty(
  cart: CartLine[],
  productId: string,
  delta: number,
  maxStock: number,
): CartResult {
  const line = cart.find((l) => l.productId === productId);
  if (!line) return { ok: true, cart };
  const next = line.qty + delta;
  if (delta > 0 && next > maxStock) {
    return { ok: false, reason: "exceeds_stock", available: maxStock };
  }
  return {
    ok: true,
    cart: cart
      .map((l) => (l.productId === productId ? { ...l, qty: next } : l))
      .filter((l) => l.qty > 0),
  };
}

export function removeLine(cart: CartLine[], productId: string): CartLine[] {
  return cart.filter((l) => l.productId !== productId);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((s, l) => s + l.price * l.qty, 0);
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((s, l) => s + l.qty, 0);
}
