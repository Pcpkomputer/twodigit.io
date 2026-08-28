// Convert number to Indonesian words (Terbilang)
export function numberToIndonesianWords(n: number): string {
  const bilangan = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];

  if (n < 0) return "minus " + numberToIndonesianWords(Math.abs(n));
  if (n === 0) return "nol";
  if (n < 12) return bilangan[n];
  if (n < 20) return numberToIndonesianWords(n - 10) + " belas";
  if (n < 100)
    return (
      bilangan[Math.floor(n / 10)] +
      " puluh" +
      (n % 10 !== 0 ? " " + bilangan[n % 10] : "")
    );
  if (n < 200)
    return "seratus" + (n - 100 !== 0 ? " " + numberToIndonesianWords(n - 100) : "");
  if (n < 1000)
    return (
      bilangan[Math.floor(n / 100)] +
      " ratus" +
      (n % 100 !== 0 ? " " + numberToIndonesianWords(n % 100) : "")
    );
  if (n < 2000)
    return (
      "seribu" + (n - 1000 !== 0 ? " " + numberToIndonesianWords(n - 1000) : "")
    );
  if (n < 1000000)
    return (
      numberToIndonesianWords(Math.floor(n / 1000)) +
      " ribu" +
      (n % 1000 !== 0 ? " " + numberToIndonesianWords(n % 1000) : "")
    );
  if (n < 1000000000)
    return (
      numberToIndonesianWords(Math.floor(n / 1000000)) +
      " juta" +
      (n % 1000000 !== 0 ? " " + numberToIndonesianWords(n % 1000000) : "")
    );
  if (n < 1000000000000)
    return (
      numberToIndonesianWords(Math.floor(n / 1000000000)) +
      " miliar" +
      (n % 1000000000 !== 0 ? " " + numberToIndonesianWords(n % 1000000000) : "")
    );
  return (
    numberToIndonesianWords(Math.floor(n / 1000000000000)) +
    " triliun" +
    (n % 1000000000000 !== 0
      ? " " + numberToIndonesianWords(n % 1000000000000)
      : "")
  );
}
