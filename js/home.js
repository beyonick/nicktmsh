/* Главная: сетка проектов из data/projects.json.

   Разметки карточек в index.html нет намеренно. Кейс добавляется одной
   записью в json — иначе «добавить проект» означало бы правку разметки,
   и через два месяца список на главной разошёлся бы со списком на /work. */

import { load, published, fail } from "./store.js";
import { card } from "./cards.js";
import { boot } from "./motion.js";

const host = document.querySelector("[data-featured]");

if (host) {
  load("projects")
    .then(({ projects }) => {
      const list = published(projects).filter((p) => p.featured);
      host.replaceChildren(...list.map((p) => card(p)));
      host.removeAttribute("aria-busy");
      // Моторика поднимается по готовой разметке: модуль отработал при
      // загрузке, когда сетка была ещё пустой.
      boot(host);
      // Секция к этому моменту уже могла войти во вьюпорт, и наблюдатель
      // из main.js отработал по пустому списку. Проявляем руками.
      host.classList.add("is-in");
    })
    .catch((err) => {
      host.removeAttribute("aria-busy");
      fail(host, err);
    });
}
