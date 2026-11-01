const playBtn = document.getElementById('playBtn');
const landing = document.querySelector('.landing');
const mainPage = document.getElementById('mainPage');

playBtn.addEventListener('click', function() {
    landing.classList.add('hidden');
    mainPage.classList.remove('hidden');
})