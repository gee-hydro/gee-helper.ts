/**
 * 桶枚举单元测试（不依赖 GEE 网络）
 * 覆盖：daily / native 在 day/week/month/range 模式下的边界对齐与 partial bucket
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyBuckets, nativeBuckets, estimateFrameCount, normalizeFrameImage,
} from '../src/export-batches';

// collection / image 归一化

test('normalizeFrameImage: ImageCollection 调用 toBands', () => {
  const image = { kind: 'image' };
  let calls = 0;
  const collection = {
    toBands: () => {
      calls++;
      return image;
    },
  };

  assert.equal(normalizeFrameImage(collection), image);
  assert.equal(calls, 1);
});

test('normalizeFrameImage: ee.Image 原样返回', () => {
  const image = { getDownloadURL: () => undefined };
  assert.equal(normalizeFrameImage(image), image);
});

// daily month

test('daily month: 跨月 + partial 头尾', () => {
  assert.deepEqual(dailyBuckets('2020-06-20', '2020-08-31', 'month'), [
    ['2020-06-20', '2020-06-30'],
    ['2020-07-01', '2020-07-31'],
    ['2020-08-01', '2020-08-31'],
  ]);
});

test('daily month: 整月区间', () => {
  assert.deepEqual(dailyBuckets('2020-07-01', '2020-07-31', 'month'),
    [['2020-07-01', '2020-07-31']]);
});

test('daily month: 闰年 2 月', () => {
  assert.deepEqual(dailyBuckets('2020-02-01', '2020-02-29', 'month'),
    [['2020-02-01', '2020-02-29']]);
  assert.deepEqual(dailyBuckets('2021-02-01', '2021-02-28', 'month'),
    [['2021-02-01', '2021-02-28']]);
});

test('daily month: 跨年', () => {
  assert.deepEqual(dailyBuckets('2020-12-15', '2021-01-15', 'month'), [
    ['2020-12-15', '2020-12-31'],
    ['2021-01-01', '2021-01-15'],
  ]);
});

// daily week

test('daily week: 对齐到 UTC 周一 + partial 头尾', () => {
  // 2024-08-05 是周一；2024-08-31 是周六
  assert.deepEqual(dailyBuckets('2024-08-05', '2024-08-31', 'week'), [
    ['2024-08-05', '2024-08-11'],
    ['2024-08-12', '2024-08-18'],
    ['2024-08-19', '2024-08-25'],
    ['2024-08-26', '2024-08-31'],
  ]);
});

test('daily week: mid-week 起点 → 单日裁剪桶（不延伸出范围）', () => {
  // 2024-08-07 是周三；严格裁剪为 [Wed, Wed]
  assert.deepEqual(dailyBuckets('2024-08-07', '2024-08-07', 'week'),
    [['2024-08-07', '2024-08-07']]);
});

// daily day / range / errors

test('daily day: 含端点', () => {
  assert.deepEqual(dailyBuckets('2024-08-05', '2024-08-07', 'day'), [
    ['2024-08-05', '2024-08-05'],
    ['2024-08-06', '2024-08-06'],
    ['2024-08-07', '2024-08-07'],
  ]);
});

test('daily range: 原样返回', () => {
  assert.deepEqual(dailyBuckets('2024-08-05', '2024-08-11', 'range'),
    [['2024-08-05', '2024-08-11']]);
});

test('daily: start > end throws', () => {
  assert.throws(() => dailyBuckets('2024-08-10', '2024-08-05', 'day'), /start/);
});

// native

test('native day (1h): bucketEnd = 当日 23:00:00Z', () => {
  assert.deepEqual(
    nativeBuckets('2024-08-05T00:00:00Z', '2024-08-06T12:00:00Z', 1, 'day'),
    [
      ['2024-08-05T00:00:00Z', '2024-08-05T23:00:00Z'],
      ['2024-08-06T00:00:00Z', '2024-08-06T12:00:00Z'],
    ],
  );
});

test('native day (0.5h): 全日范围', () => {
  assert.deepEqual(
    nativeBuckets('2024-08-05T00:00:00Z', '2024-08-05T23:30:00Z', 0.5, 'day'),
    [['2024-08-05T00:00:00Z', '2024-08-05T23:30:00Z']],
  );
});

test('native week (1h): Mon→Sun(23h)', () => {
  assert.deepEqual(
    nativeBuckets('2024-08-05T00:00:00Z', '2024-08-25T23:00:00Z', 1, 'week'),
    [
      ['2024-08-05T00:00:00Z', '2024-08-11T23:00:00Z'],
      ['2024-08-12T00:00:00Z', '2024-08-18T23:00:00Z'],
      ['2024-08-19T00:00:00Z', '2024-08-25T23:00:00Z'],
    ],
  );
});

test('native month (1h): 每月末日 23:00:00Z 收尾', () => {
  assert.deepEqual(
    nativeBuckets('2024-07-15T00:00:00Z', '2024-08-31T23:00:00Z', 1, 'month'),
    [
      ['2024-07-15T00:00:00Z', '2024-07-31T23:00:00Z'],
      ['2024-08-01T00:00:00Z', '2024-08-31T23:00:00Z'],
    ],
  );
});

test('native range: 原样返回', () => {
  assert.deepEqual(
    nativeBuckets('2024-08-05T00:00:00Z', '2024-08-11T23:00:00Z', 1, 'range'),
    [['2024-08-05T00:00:00Z', '2024-08-11T23:00:00Z']],
  );
});

test('native: 非法 stepHours throws', () => {
  assert.throws(() => nativeBuckets('2024-08-05T00:00:00Z', '2024-08-05T00:00:00Z', 0, 'day'), /stepHours/);
  assert.throws(() => nativeBuckets('2024-08-05T00:00:00Z', '2024-08-05T00:00:00Z', 25, 'day'), /stepHours/);
});

// frame count（与 GEE 服务端步长一致）

test('estimateFrameCount daily 含端点', () => {
  assert.equal(estimateFrameCount('2024-08-05', '2024-08-05', 'daily_mean'), 1);
  assert.equal(estimateFrameCount('2024-08-05', '2024-08-11', 'daily_mean'), 7);
});

test('estimateFrameCount native 1h 含端点', () => {
  assert.equal(
    estimateFrameCount('2024-08-05T00:00:00Z', '2024-08-05T23:00:00Z', 'native', 1), 24);
  assert.equal(
    estimateFrameCount('2024-08-05T00:00:00Z', '2024-08-06T12:00:00Z', 'native', 1), 37);
});

test('estimateFrameCount native 0.5h', () => {
  assert.equal(
    estimateFrameCount('2024-08-05T00:00:00Z', '2024-08-05T23:30:00Z', 'native', 0.5), 48);
});