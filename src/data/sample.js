// Deterministic demo data for a small power-tools store.
// Dates are relative to "now" so the demo always looks current.
const DAY = 24 * 60 * 60 * 1000;
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600 * 1000);

export const products = [
  { id: 'P1', name: 'Cordless Drill 18V', category: 'Drills', price: 4499, stock: 4, reorderLevel: 8 },
  { id: 'P2', name: 'Angle Grinder 850W', category: 'Grinders', price: 2899, stock: 22, reorderLevel: 8 },
  { id: 'P3', name: 'Impact Driver Kit', category: 'Drills', price: 5999, stock: 2, reorderLevel: 5 },
  { id: 'P4', name: 'Jigsaw 650W', category: 'Saws', price: 3299, stock: 15, reorderLevel: 6 },
  { id: 'P5', name: 'Circular Saw 1200W', category: 'Saws', price: 6499, stock: 9, reorderLevel: 5 },
  { id: 'P6', name: 'Drill Bit Set (29 pcs)', category: 'Accessories', price: 899, stock: 60, reorderLevel: 20 },
];

const byId = Object.fromEntries(products.map((p) => [p.id, p]));
const line = (productId, qty) => ({ productId, qty, price: byId[productId].price });

// Orders: the previous 7 days are healthy; the last 7 days have fewer drill sales
// (stock-outs + failed payments), so "why did sales drop" has a real, explainable answer.
export const orders = [
  // --- previous week (days 8-14) ---
  { id: 'O1001', customer: 'Amit', placedAt: ago(13), status: 'delivered', items: [line('P1', 2), line('P6', 1)] },
  { id: 'O1002', customer: 'Neha', placedAt: ago(12), status: 'delivered', items: [line('P3', 1)] },
  { id: 'O1003', customer: 'Karan', placedAt: ago(12, 3), status: 'delivered', items: [line('P2', 1), line('P6', 2)] },
  { id: 'O1004', customer: 'Sana', placedAt: ago(11), status: 'delivered', items: [line('P1', 1)] },
  { id: 'O1005', customer: 'Vikram', placedAt: ago(10), status: 'delivered', items: [line('P5', 1)] },
  { id: 'O1006', customer: 'Pooja', placedAt: ago(10, 5), status: 'delivered', items: [line('P3', 2)] },
  { id: 'O1007', customer: 'Rahul', placedAt: ago(9), status: 'delivered', items: [line('P1', 2)] },
  { id: 'O1008', customer: 'Meena', placedAt: ago(9, 6), status: 'delivered', items: [line('P4', 1), line('P6', 1)] },
  { id: 'O1009', customer: 'Dev', placedAt: ago(8), status: 'delivered', items: [line('P2', 2)] },
  // --- last week (days 0-7) ---
  { id: 'O1010', customer: 'Isha', placedAt: ago(6), status: 'delivered', items: [line('P4', 1)] },
  { id: 'O1011', customer: 'Arjun', placedAt: ago(5), status: 'delivered', items: [line('P5', 1)] },
  { id: 'O1012', customer: 'Ritu', placedAt: ago(4), status: 'shipped', items: [line('P2', 1), line('P6', 1)] },
  { id: 'O1013', customer: 'Manoj', placedAt: ago(3), status: 'delivered', items: [line('P1', 1)] },
  { id: 'O1014', customer: 'Priya', placedAt: ago(1, 2), status: 'shipped', items: [line('P6', 3)] },
  { id: 'O1015', customer: 'Sahil', placedAt: ago(0, 3), status: 'pending', items: [line('P5', 1)] },
  { id: 'O1016', customer: 'Anita', placedAt: ago(0, 1), status: 'pending', items: [line('P2', 1)] },
  { id: 'O1017', customer: 'Gopal', placedAt: ago(0, 5), status: 'paid', items: [line('P4', 1), line('P6', 1)] },
];

// Payment attempts (successful and failed). Failed attempts on drills spiked this week.
export const payments = [
  ...orders.map((o) => ({ orderId: o.id, at: o.placedAt, status: 'success', method: 'upi' })),
  { orderId: null, productId: 'P1', at: ago(5), status: 'failed', reason: 'upi_timeout' },
  { orderId: null, productId: 'P1', at: ago(4), status: 'failed', reason: 'upi_timeout' },
  { orderId: null, productId: 'P3', at: ago(3), status: 'failed', reason: 'bank_declined' },
  { orderId: null, productId: 'P1', at: ago(2), status: 'failed', reason: 'upi_timeout' },
  { orderId: null, productId: 'P1', at: ago(1), status: 'failed', reason: 'upi_timeout' },
  { orderId: null, productId: 'P3', at: ago(10), status: 'failed', reason: 'bank_declined' },
];

export const carts = [
  { id: 'C1', customer: 'Harsh', updatedAt: ago(0, 30), items: [line('P1', 1)] },
  { id: 'C2', customer: 'Kavya', updatedAt: ago(1, 4), items: [line('P3', 1), line('P6', 1)] },
  { id: 'C3', customer: 'Nitin', updatedAt: ago(0, 2), items: [line('P2', 1)] },
  { id: 'C4', customer: 'Zoya', updatedAt: ago(3), items: [line('P5', 1)] },
];

export const policy = {
  returnWindowDays: 7,
  refundDays: '5-7 business days after the item is received back',
  shippingDays: '3-5 business days',
};
