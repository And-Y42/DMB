const titlePage = document.getElementById('title-page');
const homePage = document.getElementById('home-page');
const guessPage = document.getElementById('guess-page');

const goToGuessBtn = document.getElementById('go-to-guess'); // The new button

titlePage.addEventListener('click', () => {
    titlePage.classList.remove('visible'); // fade out
    homePage.classList.add('visible');     // fade in
});

goToGuessBtn.addEventListener('click', () => {
    homePage.classList.remove('visible');  // fade out
    guessPage.classList.add('visible');    // fade in
});

const connections = [
    ['at-a-loss-image', 'ocrimey-image'],
    ['newspaper-image', 'at-a-loss-image'],
    ['ocrimey-image', 'victim-image'],
    ['suspect1-image', 'suspect1-note-image'],
    ['suspect1-image', 'victim-image'],
    ['fabric-image', 'victim-image'],
    ['suspect2-image', 'suspect2-note-image'],
    ['suspect2-image', 'victim-image'],
    ['suspect3-image', 'suspect3-note-image'],
    ['suspect3-image', 'victim-image'],
    ['victim-image', 'victim-note-image'],
    ['crime-image', 'victim-note-image'],
    ['crime-image', 'large-notecard-image'],
    ['victim-image', 'notecard-plain-image'],
    ['notecard-plain-image', 'small-note-image'],
    // Add more pairs here
];

function updateLines() {
    const svg = document.getElementById("connections");
    svg.innerHTML = ''; // Clear previous lines

    connections.forEach(([id1, id2]) => {
        const el1 = document.getElementById(id1);
        const el2 = document.getElementById(id2);
        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", rect1.left + rect1.width / 2);
        line.setAttribute("y1", rect1.top + rect1.height / 2);
        line.setAttribute("x2", rect2.left + rect2.width / 2);
        line.setAttribute("y2", rect2.top + rect2.height / 2);
        line.setAttribute("stroke", "red");
        line.setAttribute("stroke-width", "8");

        svg.appendChild(line);
    });
}

window.addEventListener('load', updateLines);
window.addEventListener('resize', updateLines);


// Correct answers
const correctAnswers = {
    "whois": "SUS 2",
    "whatwas": "Revenge",
    "isthere": "SUS 1"
};

const correctMessages = {
    "whois": (answer) => `Correct! ${answer} was the murderer.`,
    "whatwas": (answer) => `Correct! ${answer.toUpperCase()} was the motive.`,
    "isthere": (answer) => `Correct! ${answer} was an accomplice.`
};

const incorrectMessages = {
    "whois": () => `Oops, wrong suspect!`,
    "whatwas": () => `Nope! That's not the motive.`,
    "isthere": () => `Incorrect! That's not the accomplice.`
};

const guessCounters = {
    "whois": 0,
    "whatwas": 0,
    "isthere": 0
};

const correctStatus = {
    "whois": false,
    "whatwas": false,
    "isthere": false
};

document.querySelectorAll('.button-group button').forEach(button => {
    button.addEventListener('click', function () {
        const group = button.closest('.image-group');
        const question = group.getAttribute('data-question');
        const selectedAnswer = button.getAttribute('data-answer');
        const correctAnswer = correctAnswers[question];

        if (correctStatus[question]) return;

        guessCounters[question]++;

        sessionStorage.setItem(question, selectedAnswer);

        group.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('selected', 'correct', 'wrong');
        });

        let resultDisplay = group.querySelector('.result-message');
        if (!resultDisplay) {
            resultDisplay = document.createElement('div');
            resultDisplay.className = 'result-message';
            group.appendChild(resultDisplay);
        }

        if (selectedAnswer === correctAnswer) {
            correctStatus[question] = true;
            button.classList.add('correct');
            resultDisplay.textContent = correctMessages[question](selectedAnswer);

            group.querySelectorAll('button').forEach(btn => {
                if (btn !== button) {
                    btn.classList.add('wrong');
                }
            });

            // Check if all questions are now correct
            if (Object.values(correctStatus).every(status => status)) {
                showModal();
            }
        } else {
            button.classList.add('wrong');
            resultDisplay.textContent = incorrectMessages[question]();
        }
    });
});

function showModal() {
    const modal = document.getElementById('resultModal');
    const modalContent = document.getElementById('modalText');
    modalContent.innerHTML = `
        <h2>Results</h2>
        <p>Who was the murderer: ${guessCounters["whois"]} guess(es)</p>
        <p>What was the motive: ${guessCounters["whatwas"]} guess(es)</p>
        <p>Was there an accomplice: ${guessCounters["isthere"]} guess(es)</p>
    `;
    modal.style.display = 'block';
}

// Close modal on click
document.getElementById('closeModal').addEventListener('click', function () {
    document.getElementById('resultModal').style.display = 'none';
});
