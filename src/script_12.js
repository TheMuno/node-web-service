import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, 
    getDocs, updateDoc, deleteField, collection,
    arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);   

const baseUrl = 'https://run-gemini.onrender.com/';  // 'http://localhost:3000/';

!function resetLocalStorage() {
    localStorage.removeItem('days');
    localStorage.removeItem('hotel');
    localStorage.removeItem('attractions');
    localStorage.removeItem('other-attractions');       
    localStorage.removeItem('firstTime');
    localStorage.removeItem('occasion');
    localStorage.removeItem('travelWith');
    localStorage.removeItem('dayCount'); 
}();

!async function createUserInFirebase(userMail) {
    if (!userMail) return;
    const userRef = doc(db, 'travelData', `user-${userMail}`);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) return;
    await setDoc(userRef, { createdAt: serverTimestamp() }); 
}(localStorage.getItem('user-email')); 

const $userMail = document.querySelector('.gp-user-email');
if (localStorage.userMail) {
    $userMail.value = localStorage.userMail;
}
$userMail.addEventListener('change', e => {
    localStorage.userMail = e.currentTarget.value; 
});

const fp = flatpickr('.gp-date', {
    mode: 'range',
    altInput: true,
    enableTime: true,
    altFormat: 'D M j',
    dateFormat: 'Y-m-d',
    onClose: (selectedDates, dateStr, instance) => {
        if (!selectedDates.length) return;
        // console.log('selectedDates', selectedDates)

        // appendTravelDates(selectedDates);
        const dayCount = getDays(dateStr); 
        // localStorage.days = days;

        const startDay = new Date(selectedDates[0]).toDateString();
        const endDay = new Date(selectedDates[1]).toDateString();
        const days = `${startDay} to ${endDay}`;

        localStorage.days = days; 
        localStorage.dayCount = dayCount; 

        // console.log('Days:', days)
    },
});

function getDays(dateStr) {
    const startDate = dateStr.split('to')[0].trim(); 
    const endDate = dateStr.split('to')[1].trim(); 
    const days = Math.ceil( ( new Date(endDate).getTime() - new Date(startDate).getTime() ) / (1000 * 60 * 60 * 24) ) + 1; 

    return days;
}

document.querySelectorAll('[gp-wrap="gp-first-timer-wrap"] input[type=radio]').forEach(btn => {
    btn.addEventListener('click', e => {
        if (e.currentTarget.value.trim() === 'yes' && btn.checked) {
            localStorage.firstTime = true;
        }
        else {
            localStorage.removeItem('firstTime');
        }
    });
}); 

document.querySelectorAll('[gp-wrap="gp-travel-with-wrap"] input[type=radio]').forEach(btn => {
    btn.addEventListener('click', e => {
        const val = btn.value.trim();
        if (val.includes('myself')) {
            localStorage.removeItem('travelWith');
        }
        else {
            localStorage.travelWith = val.includes('partner') ? localStorage.travelWith = 'my partner' : localStorage.travelWith = val;
        }
    });
});

document.querySelectorAll('[gp-wrap="gp-occasion-wrap"] input[type=radio]').forEach(btn => {
    btn.addEventListener('click', e => {
        if (btn.value.trim()) {
            localStorage.occasion = btn.value.trim();
        }
        else {
            localStorage.removeItem('occasion')
        }
    });
}); 

function generatePrompt(display) {
    const days = localStorage.days || 1;
    const dayCount = localStorage.dayCount || 1;
    const hotel = localStorage.hotel || 'hotels';
    const attractions = JSON.parse(localStorage.attractions).join(', ') || ''; 
    let otherAttractions = localStorage['other-attractions'] || ''; 
    if (otherAttractions) otherAttractions = otherAttractions.split(/\n|,/).filter(x => x.trim()).join(', '); 

    let firstTime = localStorage.firstTime || '';
    if (firstTime) firstTime = 'a first time visitor to ';

    let travelWith = localStorage.travelWith || '';
    if (travelWith) travelWith = ` with ${localStorage.travelWith}`;

    let occasion = localStorage.occasion || '';
    if (occasion) occasion = ` for a ${localStorage.occasion}`;

    const str = ` Create a ${display ? dayCount : days} day plan for ${firstTime}NYC${travelWith}${occasion} that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants, 
    make it sound like a story,
    pay attention to the dates to determine the season and recommend appropriate activities
    ${display ? '' : `in the format
        {
            'Day, Month Date Year': {
                morning: {
                    title: '',
                    description: '', 
                    coordinates: [lat,lng]
                },
                afternoon: {
                    title: '',
                    description: '', 
                    coordinates: [lat,lng]
                },
                evening: {
                    title: '',
                    description: '', 
                    coordinates: [lat,lng]
                }
            }
        }`
    }`;
        
    // the place names and their coordinates should be wrapped in brackets ()`;
    // with Google Map coordinates for each place wrapped in []
    return str; 
}

const $inpPrompts = document.querySelectorAll('.gp-form .gp-input:not(.gp-textarea)');
const $otherAttr = document.querySelector('#other-attractions');
const $attrCheckboxes = document.querySelectorAll('.gp-checkbox input');
const $submitBtn = document.querySelector('.gp-btn');
const $prompt = document.querySelector('.gp-prompt span');
const $result = document.querySelector('.gp-result');
const $gpScrollToTryOutBtn = document.querySelector('.gp-try-out-scroll-to-btn');
const $gpTryOutInp = document.querySelector('.gp-try-out-input');
const $gpTryOutRes = document.querySelector('.gp-try-out-result');
const $gpTryOutPromptBtn = document.querySelector('.gp-try-out-btn');

$gpTryOutPromptBtn.addEventListener('click', async e => {
    e.preventDefault();

    const prompt = $gpTryOutInp.value.trim();
    if (!prompt) return;

    const gpTryOutPromptBtnVal = $gpTryOutPromptBtn.value;

    $gpTryOutPromptBtn.value = 'Loading...';
    $gpTryOutRes.innerHTML = '';

    const result = await postTextPrompt(prompt); 

    // $gpTryOutRes.textContent = result;
    $gpTryOutRes.innerHTML = result.replace(/\*+/g, '<br>');

    $gpTryOutPromptBtn.value = gpTryOutPromptBtnVal;
});

$gpScrollToTryOutBtn.addEventListener('click', e => {
    $gpTryOutRes.scrollIntoView({behavior: 'smooth', block: 'end'});
});

$inpPrompts.forEach(inp => {
    inp.addEventListener('change', e => {
    handleInpChange(e);
    });
});

$otherAttr.addEventListener('change', e => {
    handleInpChange(e); 
});

function handleInpChange(e) {
    const name = e.currentTarget.name;
    if (!name) return;
    localStorage[name] = e.currentTarget.value;   
}

$attrCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('click', () => {
    const attractions = localStorage.attractions ? JSON.parse(localStorage.attractions) : []; 
    const checkboxName = format(checkbox.name);
    if (checkbox.checked) {
        attractions.push(checkboxName);
    }
    else {
        attractions.splice(attractions.indexOf(checkboxName), 1);
    }
    localStorage.attractions = JSON.stringify(attractions); 
    });
});

function format(str) {
    return str = str.trim().split('-').map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

$submitBtn.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit(e);
});

function checkJSON(json) {
    let res;
    try {
        res = JSON.parse(json);
    }
    catch(e) {
        res = e.message;
    }
    return res;
}

function isObject(obj) {
    return obj === Object(obj) && Object.prototype.toString.call(obj) !== '[object Array]';
}

async function handleSubmit(e) {
    if ([...$inpPrompts].filter(i => i.value.trim() === '').length) return;

    const $submitBtn = e.currentTarget;
    const submitBtnVal = $submitBtn.value;
    $submitBtn.value = 'Loading...';

    const prompt = generatePrompt(); 
    const displayPrompt = generatePrompt(true);
    $prompt.textContent = displayPrompt; // prompt.substring(0, prompt.indexOf('in the format'));

    console.log('Payload:', prompt)

    $result.innerHTML = '';

    let result = await postPrompt(prompt); 
    // $result.textContent = result.info; 

    // console.log(result) 

    let resultObj; 

    if ( isObject( checkJSON(result) ) ) {
        resultObj = JSON.parse(result);
    }
    else {
        result += '}';
        resultObj = JSON.parse(result);
    }

    console.log(resultObj)

    let entireDayPlan = '',
    markers = [],
    markers2 = [];
    for(let [day, times] of Object.entries(resultObj)) {
        const { morning, afternoon, evening } = times;

        // const lat = morning.coordinates[0];
        // const lng = morning.coordinates[1];

        /*const eventObj = {
            dayEventName,
            lat,
            lng,
            title,
        }*/

        // console.log('morning', morning)
        // console.log('afternoon', afternoon)
        // console.log('evening', evening)

        const obj = {
            dayDate: day,
            morning,
            afternoon,
            evening
        };

        markers2.push(obj);

        // console.log('markers2', markers2)

        markers.push(morning.coordinates, afternoon.coordinates, evening.coordinates);

        entireDayPlan += `<div class="margin-top-20">
                            <div class="day">${day}</div> 
                            <div class="gp-day-events">
                                <div>
                                    <div class="gp-header">Morning</div>
                                    <div class="gp-title">${morning.title}</div>
                                    <div class="gp-desc">${morning.description}</div>
                                </div>
                                <div>
                                    <div class="gp-header">Afternoon</div>
                                    <div class="gp-title">${afternoon.title}</div>
                                    <div class="gp-desc">${afternoon.description}</div>
                                </div>
                                <div>
                                    <div class="gp-header">Evening</div>
                                    <div class="gp-title">${evening.title}</div>
                                    <div class="gp-desc">${evening.description}</div>
                                </div>   
                            </div>
                        </div>`; 
    }

    $result.innerHTML = entireDayPlan; 
    $submitBtn.value = submitBtnVal;

    console.log('markers', markers)
    initMap(markers); 

    if (!localStorage.userMail) return; 
    // saveMarkerToFirebase(localStorage.userMail, markers); 
    saveMarkersToFirebase(localStorage.userMail, markers2);
}

async function postPrompt(prompt) {
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            payload: prompt
        })
    });

    return res.json();
} 

async function postTextPrompt(prompt) {
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            payload: prompt,
            tryOut: true
        })
    });

    return res.text();
} 

// Google Map

// Initialize and add the map
const $map = document.querySelector('.gp-map');
let map;

async function initMap(markers) {
    // The location of Uluru
    const position = { lat: 40.706005, lng: -74.008827 };
    // Request needed libraries.
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // The map, centered at Uluru
    map = new Map($map, {
        zoom: 10,
        center: position,
        mapId: "DEMO_MAP_ID",
    });

    const bounds = new google.maps.LatLngBounds();
    const iconUrl = 'https://cdn.prod.website-files.com/6666bd4119f3f071441485fe/66dec46b646f9970dd5a15e7_camera.png';

    // The marker, positioned at Uluru
    // const marker = new AdvancedMarkerElement({
    //     map: map,
    //     position: position,
    //     title: "Uluru",
    // });

    markers.forEach(markerCoords => {
        const marker = createMarker(markerCoords); 
        // console.log('Marker:', marker)
        // console.log('Marker.position', marker.position)
        if (marker && marker.position) bounds.extend(marker.position);
    });

    map.fitBounds(bounds);

    function createMarker(position) {
        const lat = position[0],
                lng = position[1];

        if (!lat || !lng) return;

        const iconImage = document.createElement('img');
        iconImage.className = 'gp-map-icon';
        iconImage.src = iconUrl;

        const marker = new AdvancedMarkerElement({
            map: map,
            position: new google.maps.LatLng(lat, lng),
            content: iconImage,
            // gmpClickable: true,
            // title: "Uluru",
        });

        /*marker.addListener("click", ({ domEvent, latLng }) => {
            const { target } = domEvent;
        
            infoWindow.close();
            infoWindow.setContent(marker.title);
            infoWindow.open(marker.map, marker);
        });*/

        return marker; 
    }
}

async function saveMarkerToFirebase(userMail, markers) {  
    const userData = doc(db, 'geminiData', `user-${userMail}`); 
    const docSnap = await getDoc(userData);
    const data = await docSnap.data(); 
    
    // const currentMarkers = data.markers; 

    const saveObj = {}; 
    saveObj.markers = JSON.stringify(markers);  

    saveObj.modifiedAt = serverTimestamp();

    await updateDoc(userData, saveObj);
}

async function saveMarkersToFirebase(userMail, markers) {
    const userData = doc(db, 'travelData', `user-${userMail}`); 
    const docSnap = await getDoc(userData);
    const data = await docSnap.data(); 

    let { days } = data; 

    if (!days) days = [];

    // console.log('markers:::::', markers)
    // console.log('days:::', days)

    markers.forEach(marker => {
        const { dayDate, morning, afternoon, evening } = marker;

        const morningEvent = {
            dayEventName: morning.title,
            title: morning.title,
            lat: morning.coordinates[0],
            lng: morning.coordinates[1],
            timeslot: 'morning',
        };
    
        const afternoonEvent = {
            dayEventName: afternoon.title,
            title: afternoon.title,
            lat: afternoon.coordinates[0],
            lng: afternoon.coordinates[1],
            timeslot: 'afternoon',
        };
    
        const eveningEvent = {
            dayEventName: evening.title,
            title: evening.title,
            lat: evening.coordinates[0],
            lng: evening.coordinates[1],
            timeslot: 'evening',
        };

        const obj = {
            dayDate,
            events: [morningEvent, afternoonEvent, eveningEvent],
            summary: '',
        }

        days.push(obj);
    });

    // console.log('days:::', days)

    // const eventObj = {
    //     dayEventName,
    //     lat,
    //     lng,
    //     title,
    //     timeslot,
    // }

    const saveObj = {}; 
    saveObj.days = days;  
    saveObj.modifiedAt = serverTimestamp(); 
    await updateDoc(userData, saveObj);
}
