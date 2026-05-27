function checkCNPJ(cnpj) {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n, weights) =>
    11 -
    (n
      .split('')
      .slice(0, weights.length)
      .reduce((s, c, i) => s + +c * weights[i], 0) %
      11);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d, w1) >= 10 ? 0 : calc(d, w1);
  const d2 = calc(d, w2) >= 10 ? 0 : calc(d, w2);
  return +d[12] === d1 && +d[13] === d2;
}

function generateRandomCNPJ() {
  while (true) {
    const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
    const candidateBase = random8 + '0001';
    for (let i = 0; i <= 99; i++) {
      const suffix = i.toString().padStart(2, '0');
      const candidate = candidateBase + suffix;
      if (checkCNPJ(candidate)) {
        return candidate;
      }
    }
  }
}

console.log('CNPJ:', generateRandomCNPJ());
