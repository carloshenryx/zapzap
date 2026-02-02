import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractFirstNumericAnswer,
  normalizeTo10,
  getUnifiedScore10,
  getUnifiedScore5,
  isLowScore10,
  getScoreLabel5,
} from '../src/lib/ratingUtils.js';

test('extractFirstNumericAnswer finds 0', () => {
  assert.equal(extractFirstNumericAnswer({ a: 'x', b: 0, c: 5 }), 0);
});

test('normalizeTo10 converts 0-5 scale to 0-10', () => {
  assert.equal(normalizeTo10(0), 0);
  assert.equal(normalizeTo10(1), 2);
  assert.equal(normalizeTo10(5), 10);
});

test('normalizeTo10 preserves 0-10 scale', () => {
  assert.equal(normalizeTo10(7), 7);
  assert.equal(normalizeTo10(10), 10);
});

test('getUnifiedScore10 uses custom_answers when overall_rating is null', () => {
  assert.equal(getUnifiedScore10({ overall_rating: null, custom_answers: { q1: 0 } }), 0);
});

test('getUnifiedScore5 maps 1 star to 1 on 0-5?', () => {
  assert.equal(getUnifiedScore5({ overall_rating: 1 }), 1);
  assert.equal(getUnifiedScore5({ overall_rating: 0 }), 0);
});

test('0 score is always low', () => {
  assert.equal(isLowScore10(0, 4), true);
});

test('getScoreLabel5 labels 0 as Muito ruim', () => {
  assert.equal(getScoreLabel5(0).label, 'Muito ruim');
});
