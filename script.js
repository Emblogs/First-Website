const slides = document.querySelectorAll(".ss");
const dots = document.querySelectorAll(".dot");
const bar = document.getElementById("progressBar");

let current = 0;
let interval;
const DURATION = 4000; // 4 seconds

function goToSlide(index) {
  slides[current].classList.remove("active");
  dots[current].classList.remove("active");

  current = (index + slides.length) % slides.length;

  slides[current].classList.add("active");
  dots[current].classList.add("active");

  resetProgress();
}

function changeSlide(dir) {
  clearInterval(interval);
  goToSlide(current + dir);
  startAutoPlay();
}

function resetProgress() {
  bar.style.transition = "none";
  bar.style.width = "0%";
  setTimeout(() => {
    bar.style.transition = `width ${DURATION}ms linear`;
    bar.style.width = "100%";
  }, 50);
}

function startAutoPlay() {
  clearInterval(interval);
  interval = setInterval(() => {
    goToSlide(current + 1);
  }, DURATION);
}

// Pause on hover
const hero = document.getElementById("hero");
hero.addEventListener("mouseenter", () => clearInterval(interval));
hero.addEventListener("mouseleave", () => startAutoPlay());

// Kick off
resetProgress();
startAutoPlay();
