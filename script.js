const SLOTS = ['A', 'B', 'C'];
let people = []; 
let history = {
    A: { workedCycle: [], lastAssigned: [] },
    B: { workedCycle: [], lastAssigned: [] },
    C: { workedCycle: [] , lastAssigned: [] }
};

// --- Initialization and State Management ---

function loadState() {
    const storedPeople = localStorage.getItem('slot_people_v2'); 
    if (storedPeople) {
        people = JSON.parse(storedPeople);
    }
    
    const storedHistory = localStorage.getItem('slot_history_v2');
    if (storedHistory) {
        history = JSON.parse(storedHistory);
    }
}

function saveState() {
    localStorage.setItem('slot_people_v2', JSON.stringify(people));
    localStorage.setItem('slot_history_v2', JSON.stringify(history));
}

// --- Person Management: Add ---

function addPerson() {
    const nameInput = document.getElementById('personName');
    const name = nameInput.value.trim();

    const eligibleA = document.getElementById('eligibleA').checked;
    const eligibleB = document.getElementById('eligibleB').checked;
    const eligibleC = document.getElementById('eligibleC').checked;

    if (!name) {
        alert("Please enter a name.");
        return;
    }
    if (people.some(p => p.name === name)) {
        alert("This person is already in the list.");
        return;
    }
    if (!eligibleA && !eligibleB && !eligibleC) {
        alert("Please select at least one slot the person is qualified to work in.");
        return;
    }

    const eligible = { 
        A: eligibleA, 
        B: eligibleB, 
        C: eligibleC 
    };

    people.push({ name: name, eligible: eligible });
    
    // Reset form fields
    nameInput.value = '';
    document.getElementById('eligibleA').checked = false;
    document.getElementById('eligibleB').checked = false;
    document.getElementById('eligibleC').checked = false;
    
    saveState();
    renderPeopleList();
}

// --- Person Management: Render (Updated) ---

function renderPeopleList() {
    const listElement = document.getElementById('personList');
    listElement.innerHTML = '';
    
    people.forEach(person => {
        const slots = SLOTS.filter(s => person.eligible[s]).join(', ');
        const li = document.createElement('li');
        
        li.innerHTML = `
            ${person.name} <span style="font-size: 0.8em; color: #555;">(Slots: ${slots || 'None'})</span>
            <button class="edit-btn" onclick="editPerson('${person.name}')">Edit</button>
            <button class="delete-btn" onclick="deletePerson('${person.name}')">Delete</button>
            <label>Absent? <input type="checkbox" data-person="${person.name}"></label>
        `;
        listElement.appendChild(li);
    });

    document.getElementById('personCount').textContent = people.length;
    renderHistory();
}

// --- Person Management: Edit and Delete (New Functions) ---

function editPerson(name) {
    const person = people.find(p => p.name === name);
    if (!person) return;

    // Show the edit form and populate fields
    document.getElementById('editFormContainer').style.display = 'block';
    document.getElementById('editingNameDisplay').textContent = name;
    document.getElementById('editOriginalName').value = name;
    
    document.getElementById('editPersonName').value = person.name;
    document.getElementById('editEligibleA').checked = person.eligible.A;
    document.getElementById('editEligibleB').checked = person.eligible.B;
    document.getElementById('editEligibleC').checked = person.eligible.C;
}

function saveEdit() {
    const originalName = document.getElementById('editOriginalName').value;
    const newName = document.getElementById('editPersonName').value.trim();
    const newEligibleA = document.getElementById('editEligibleA').checked;
    const newEligibleB = document.getElementById('editEligibleB').checked;
    const newEligibleC = document.getElementById('editEligibleC').checked;

    if (!newName) {
        alert("New name cannot be empty.");
        return;
    }
    if (newName !== originalName && people.some(p => p.name === newName)) {
        alert("A person with this new name already exists.");
        return;
    }
    if (!newEligibleA && !newEligibleB && !newEligibleC) {
        alert("Please select at least one slot the person is qualified to work in.");
        return;
    }

    const personIndex = people.findIndex(p => p.name === originalName);
    if (personIndex === -1) return;

    // 1. Update the person data
    people[personIndex].name = newName;
    people[personIndex].eligible = { 
        A: newEligibleA, 
        B: newEligibleB, 
        C: newEligibleC 
    };
    
    // 2. Update history if the name changed
    if (originalName !== newName) {
        SLOTS.forEach(slot => {
            // Update workedCycle history
            history[slot].workedCycle = history[slot].workedCycle.map(pName => 
                pName === originalName ? newName : pName
            );
            // Update lastAssigned history
            history[slot].lastAssigned = history[slot].lastAssigned.map(pName => 
                pName === originalName ? newName : pName
            );
        });
    }

    // 3. Hide form, save state, and re-render
    document.getElementById('editFormContainer').style.display = 'none';
    saveState();
    renderPeopleList();
}

function cancelEdit() {
    document.getElementById('editFormContainer').style.display = 'none';
}

function deletePerson(name) {
    if (!confirm(`Are you sure you want to delete ${name}? This will also clear their history.`)) {
        return;
    }

    // 1. Remove person from the people array
    people = people.filter(p => p.name !== name);

    // 2. Clean up history
    SLOTS.forEach(slot => {
        // Remove from workedCycle
        history[slot].workedCycle = history[slot].workedCycle.filter(pName => pName !== name);
        // Remove from lastAssigned
        history[slot].lastAssigned = history[slot].lastAssigned.filter(pName => pName !== name);
    });
    
    // 3. Save state and re-render
    saveState();
    renderPeopleList();
}


// --- Allotment Logic (Unchanged from previous update) ---

function generateAllotment() {
    // 1. Identify Absent People and calculate available pool
    const absentNames = Array.from(document.querySelectorAll('#personList input[type="checkbox"]:checked'))
                               .map(checkbox => checkbox.dataset.person);

    const availablePeople = people.filter(p => !absentNames.includes(p.name));
    
    if (availablePeople.length < 3) {
        alert(`Only ${availablePeople.length} people available today. Cannot fill all 3 slots.`);
        return;
    }

    let allotment = {};
    let assignedNames = [];
    let pool = [...availablePeople]; // Mutable copy of available people objects
    
    // 2. Main Allotment Loop
    for (const slot of SLOTS) {
        // Find all people qualified for this slot AND not yet assigned today
        let slotCandidates = pool.filter(p => p.eligible[slot] && !assignedNames.includes(p.name));
        
        // If no one is qualified or available, skip the slot
        if (slotCandidates.length === 0) {
            allotment[slot] = 'UNFILLED - No qualified person present.';
            continue;
        }

        const activeCycle = history[slot].workedCycle;
        // Names of all people who are PRESENT and ELIGIBLE for this slot
        const eligiblePresentNames = availablePeople
            .filter(p => p.eligible[slot])
            .map(p => p.name);
            
        // Check if everyone PRESENT and ELIGIBLE has worked since the last cycle reset
        const cycleComplete = eligiblePresentNames.length > 0 && 
                              eligiblePresentNames.every(name => activeCycle.includes(name));

        let selectedPerson = null;
        let candidateToAssign = null;
        
        // Strategy 1: Find someone qualified (and unassigned) who has NOT worked this slot since the last reset
        candidateToAssign = slotCandidates.find(p => !activeCycle.includes(p.name));

        if (candidateToAssign) {
            selectedPerson = candidateToAssign.name;
        } else if (cycleComplete) {
            // Strategy 2: Cycle IS complete for all present/eligible people. Reset cycle history and assign the first available.
            history[slot].workedCycle = [];
            
            // Re-run the find on the current candidates (who are unassigned today)
            candidateToAssign = slotCandidates[0];
            selectedPerson = candidateToAssign.name;
            
            console.log(`Cycle for Slot ${slot} completed and reset. New person assigned: ${selectedPerson}`);
        } else {
             // Strategy 3: Fallback 
             selectedPerson = slotCandidates[0].name;
             console.log(`Slot ${slot} used fallback assignment: ${selectedPerson}`);
        }


        // 3. Assign and Update State
        if (selectedPerson) {
            allotment[slot] = selectedPerson;
            assignedNames.push(selectedPerson);
            
            // Remove the assigned person from the remaining pool for the day
            pool = pool.filter(p => p.name !== selectedPerson);

            // Update the work cycle for this slot
            if (!history[slot].workedCycle.includes(selectedPerson)) {
                history[slot].workedCycle.push(selectedPerson);
            }
            
            // Update the lastAssigned history (for "last 2 repeats" constraint)
            history[slot].lastAssigned.unshift(selectedPerson);
            if (history[slot].lastAssigned.length > 2) {
                history[slot].lastAssigned.pop();
            }
        }
    }

    // 4. Display Results
    document.getElementById('slotA').textContent = `Slot A: ${allotment.A || '-'}`;
    document.getElementById('slotB').textContent = `Slot B: ${allotment.B || '-'}`;
    document.getElementById('slotC').textContent = `Slot C: ${allotment.C || '-'}`;
    
    // 5. Save and Render State
    saveState();
    renderHistory();
    alert(`Allotment generated successfully for the day!`);
}

// --- History Display and Reset ---

function renderHistory() {
    // Format history display
    const historyText = JSON.stringify(history, null, 2);
    
    document.getElementById('historyDisplay').textContent = historyText;
}

function clearHistory() {
    if (confirm("Are you sure you want to reset ALL data (People, Eligibility, and History)? This cannot be undone.")) {
        localStorage.removeItem('slot_people_v2');
        localStorage.removeItem('slot_history_v2');
        people = [];
        history = { 
            A: { workedCycle: [], lastAssigned: [] }, 
            B: { workedCycle: [], lastAssigned: [] }, 
            C: { workedCycle: [] , lastAssigned: [] }
        };
        renderPeopleList();
        document.getElementById('slotA').textContent = 'Slot A: -';
        document.getElementById('slotB').textContent = 'Slot B: -';
        document.getElementById('slotC').textContent = 'Slot C: -';
        renderHistory();
    }
}


// --- Execute on Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderPeopleList();
});