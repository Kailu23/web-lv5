let sviFilmovi = [];
let kosarica = [];

fetch('/filmovi.csv')
    .then(res => res.text())
    .then(csv => {
        const rezultat = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true
        });

        sviFilmovi = rezultat.data.map(film => ({
            title: film.Naslov,
            year: Number(film.Godina),
            genre: film.Zanr,
            duration: Number(film.Trajanje_min),
            rating: Number(film.Ocjena)
        }));

        prikaziTablicu(sviFilmovi);
    })
    .catch(err => console.error(err));

function prikaziTablicu(filmovi) {
    const tbody = document.querySelector("#filmovi-tablica tbody");
    tbody.innerHTML = "";

    filmovi.forEach(film => {
        const row = document.createElement("tr");

        row.innerHTML = `
      <td>${film.title}</td>
      <td>${film.year}</td>
      <td>${film.genre}</td>
      <td>${film.duration}</td>
      <td>${film.rating}</td>
      <td><button>Dodaj</button></td>
    `;

        tbody.appendChild(row);

        row.querySelector("button").addEventListener("click", () => {
            dodajUKosaricu(film);
        });
    });
}

document.getElementById("filtriraj-btn").addEventListener("click", filtriraj);

function filtriraj() {
    const naziv = document.getElementById("filter-naziv").value.toLowerCase();
    const zanr = document.getElementById("filter-zanr").value.toLowerCase();
    const ocjena = parseFloat(document.getElementById("filter-ocjena").value);

    const filtrirani = sviFilmovi.filter(film => {
        return (
            (!naziv || film.title.toLowerCase().includes(naziv)) &&
            (!zanr || film.genre.toLowerCase().includes(zanr)) &&
            film.rating >= ocjena
        );
    });

    prikaziTablicu(filtrirani);
}

const slider = document.getElementById("filter-ocjena");
const output = document.getElementById("ocjena-value");

slider.addEventListener("input", () => {
    output.textContent = slider.value;
});

function dodajUKosaricu(film) {
    if (!kosarica.includes(film)) {
        kosarica.push(film);
        osvjeziKosaricu();
    }
}

function osvjeziKosaricu() {
    const lista = document.getElementById("lista-kosarice");
    lista.innerHTML = "";

    kosarica.forEach((film, index) => {
        const li = document.createElement("li");
        li.textContent = film.title;

        const btn = document.createElement("button");
        btn.textContent = "X";
        btn.onclick = () => {
            kosarica.splice(index, 1);
            osvjeziKosaricu();
        };

        li.appendChild(btn);
        lista.appendChild(li);
    });
}

document.getElementById("potvrdi").addEventListener("click", () => {
    alert(`Dodano ${kosarica.length} filmova!`);
    kosarica = [];
    osvjeziKosaricu();
});
