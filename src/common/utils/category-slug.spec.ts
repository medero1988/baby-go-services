import { toCategorySlug } from './category-slug';

describe('toCategorySlug', () => {
  it.each([
    ['stroller', 'stroller'],
    [' Stroller ', 'stroller'],
    ['babyCarrier', 'baby-carrier'],
    ['BabyCarrier', 'baby-carrier'],
    ['baby_carrier', 'baby-carrier'],
    ['baby carrier', 'baby-carrier'],
    ['car-seat', 'car-seat'],
    ['CAR-SEAT', 'car-seat'],
  ])('%p → %p', (input, expected) => {
    expect(toCategorySlug(input)).toBe(expected);
  });
});
