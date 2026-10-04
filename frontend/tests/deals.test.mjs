import assert from 'node:assert/strict';
import test from 'node:test';
import { filterDeals } from '../src/utils/deals.ts';

// Discounts arrive from the server already calculated; the page only filters and orders them.
const deals = [
  { _id: 'pantry', category: 'pantry', price: 100, originalPrice: 150, discount: 33 },
  { _id: 'fruit', category: 'fruit', price: 40, originalPrice: 50, discount: 20 },
];

test('category filtering and price ordering preserve the input', () => {
  assert.deepEqual(filterDeals(deals, 'fruit', '').map((item) => item._id), ['fruit']);
  assert.deepEqual(filterDeals(deals, '', 'price').map((item) => item._id), ['fruit', 'pantry']);
  assert.deepEqual(deals.map((item) => item._id), ['pantry', 'fruit']);
  assert.deepEqual(filterDeals(deals, 'missing', ''), []);
});

test('default order is biggest discount; "saving" orders by money saved', () => {
  const mixed = [
    { _id: 'high-percent', category: 'fruit', price: 5, originalPrice: 10, discount: 50 },
    { _id: 'high-saving', category: 'fruit', price: 150, originalPrice: 200, discount: 25 },
  ];
  assert.equal(filterDeals(mixed, '', '')[0]._id, 'high-percent');
  assert.equal(filterDeals(mixed, '', 'saving')[0]._id, 'high-saving');
});
