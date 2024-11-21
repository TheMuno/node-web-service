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

const baseUrl = 'https://run-gemini.onrender.com/';  
// const baseUrl = 'http://localhost:3000/';
const promptLimit = 1;

const $tripName = document.querySelector('.gp-trip-name');
const $travelDates = document.querySelector('.gp-date');
// const $inpPrompts = document.querySelectorAll('.gp-form .gp-input:not(.gp-textarea)');
const $otherAttr = document.querySelector('#other-attractions');
const $attrCheckboxes = document.querySelectorAll('.gp-checkbox input');
// const $hotelInp = document.querySelector('#gp-hotel');
const $submitBtn = document.querySelector('.gp-prompt-btn');
const $prompt = document.querySelector('.gp-prompt span');
const $result = document.querySelector('.gp-result');
const $gpScrollToTryOutBtn = document.querySelector('.gp-try-out-scroll-to-btn');
const $gpTryOutInp = document.querySelector('.gp-try-out-input');
const $gpTryOutRes = document.querySelector('.gp-try-out-result');
const $gpTryOutPromptBtn = document.querySelector('.gp-try-out-btn');
const $maxedOutDisplay = document.querySelector('.gp-max-out');
const $firstTimeRadios = document.querySelectorAll('[gp-wrap="gp-first-timer-wrap"] input[type=radio]');
const $travelWithRadios = document.querySelectorAll('[gp-wrap="gp-travel-with-wrap"] input[type=radio]');
const $occasionRadios = document.querySelectorAll('[gp-wrap="gp-occasion-wrap"] input[type=radio]');


!function resetLocalStorage() {
    for (const name of Object.keys(localStorage)) {
        if (!name.startsWith('gp-')) continue; 
        localStorage.removeItem(name);
    }
}();

const fp = flatpickr('.gp-date', {
    mode: 'range',
    altInput: true,
    enableTime: true,
    altFormat: 'D M j',
    dateFormat: 'Y-m-d',
    onClose: (selectedDates, dateStr, instance) => {
        if (!selectedDates.length) return;

        const startDay = new Date(selectedDates[0]).toDateString() + ' ' + new Date(selectedDates[0]).toTimeString(); 
        const endDay = new Date(selectedDates[1]).toDateString() + ' ' + new Date(selectedDates[1]).toTimeString(); 
        const days = `${startDay} to ${endDay}`;

        const dayCount = getDays(dateStr); 

        localStorage['gp-days'] = days; 
        localStorage['gp-dayCount'] = dayCount; 
    },
});

function getDays(dateStr) {
    const startDate = dateStr.split('to')[0].trim(); 
    const endDate = dateStr.split('to')[1].trim(); 
    const days = Math.ceil( ( new Date(endDate).getTime() - new Date(startDate).getTime() ) / (1000 * 60 * 60 * 24) ) + 1; 

    return days;
}

$tripName.addEventListener('change', e => {
    handleInpChange(e); 
});

$otherAttr.addEventListener('change', e => {
    handleInpChange(e); 
});

function handleInpChange(e) {
    const name = e.currentTarget.name.trim().toLowerCase();
    const val = e.currentTarget.value.trim();
    if (!name) return;
    const storeName = `gp-${name}`;
    localStorage[storeName] = val;   
}

$firstTimeRadios.forEach(btn => {
    btn.addEventListener('click', e => {
        if (btn.value.trim() === 'yes' && btn.checked) {
            localStorage['gp-firstTime'] = true;
        }
        else {
            localStorage.removeItem('gp-firstTime');
        }
    });
}); 

$travelWithRadios.forEach(btn => {
    btn.addEventListener('click', e => {
        const val = btn.value.trim();
        if (val.includes('myself')) {
            localStorage.removeItem('gp-travelWith');
        }
        else {
            localStorage['gp-travelWith'] = val.includes('partner') ? 'my partner' : val;
        }
    });
});

$occasionRadios.forEach(btn => {
    btn.addEventListener('click', e => {
        if (btn.value.trim()) {
            localStorage['gp-occasion'] = btn.value.trim();
        }
        else {
            localStorage.removeItem('gp-occasion')
        }
    });
}); 

$attrCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('click', () => {
    const attractions = localStorage['gp-attractions'] ? JSON.parse(localStorage['gp-attractions']) : []; 
    const checkboxName = format(checkbox.name);
    if (checkbox.checked) {
        attractions.push(checkboxName);
    }
    else {
        attractions.splice(attractions.indexOf(checkboxName), 1);
    }
    localStorage['gp-attractions'] = JSON.stringify(attractions); 
    });
});

function format(str) {
    return str = str.trim().split('-').map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function createUserInFirebase(userMail) {
    if (!userMail) return;
    const userRef = doc(db, 'travelData', `user-${userMail}`);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) return;
    await setDoc(userRef, { createdAt: serverTimestamp() }); 
} 

function generatePrompt() {
    let { city, days, dayCount, hotel, attractions, otherAttractions, firstTime, travelWith, occasion } = processLocalStorageForPrompt();

    const prompt = `Create a ${days} day plan for ${firstTime}${city}${travelWith}${occasion} that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants. 
    Make it sound like a story.
    Pay attention to the dates to determine the season and recommend appropriate activities.
    When you do not have a specific recommendation say "ask a local".
    in the format
        {
            'Day, Month Date Year': {
                morning: {
                    title: '',
                    description: '', 
                    placeName: '',
                    coordinates: [lat,lng]
                },
                afternoon: {
                    title: '',
                    description: '', 
                    placeName: '',
                    coordinates: [lat,lng]
                },
                evening: {
                    title: '',
                    description: '', 
                    placeName: '',
                    coordinates: [lat,lng]
                }
            }
        }
    `;

    const displayPrompt = ` Create a ${dayCount} day plan for ${firstTime}${city}${travelWith}${occasion} that includes ${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''} and restaurants. 
    Make it sound like a story.
    Pay attention to the dates to determine the season and recommend appropriate activities.`;

    days = days.split('to');
    let arrival = new Date(days[0]);
    let depart = new Date(days[1]);
    arrival = `${arrival.toDateString()} ${arrival.toLocaleTimeString()}`;
    depart = `${depart.toDateString()} ${depart.toLocaleTimeString()}`;

    const saveStr = `Create a <b>${dayCount} day (<i>${arrival} to ${depart}</i>)</b> day plan for <b>${firstTime}${city}${travelWith}${occasion}</b> that includes <b>${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''}</b> and restaurants. 
    Make it sound like a story.
    Pay attention to the dates to determine the season and recommend appropriate activities.
    When you do not have a specific recommendation say "ask a local".`;
        
    return { prompt, displayPrompt, savePrompt }; 
} 

/*
function generatePromptSaveString() {
    let { city, days, dayCount, hotel, attractions, otherAttractions, firstTime, travelWith, occasion } = processLocalStorageForPrompt();

    days = days.split('to');
    let arrival = new Date(days[0]);
    let depart = new Date(days[1]);
    arrival = `${arrival.toDateString()} ${arrival.toLocaleTimeString()}`;
    depart = `${depart.toDateString()} ${depart.toLocaleTimeString()}`;

    const str = `Create a <b>${dayCount} day (<i>${arrival} to ${depart}</i>)</b> day plan for <b>${firstTime}${city}${travelWith}${occasion}</b> that includes <b>${hotel}${attractions ? ', '+attractions : ''}${otherAttractions ? ', '+otherAttractions : ''}</b> and restaurants. 
    Make it sound like a story.
    Pay attention to the dates to determine the season and recommend appropriate activities.
    When you do not have a specific recommendation say "ask a local".`;

    return str;
}
*/

function processLocalStorageForPrompt() {
    const city = localStorage['gp-city'] || 'NYC';
    const days = localStorage['gp-days'] || 1;
    const dayCount = localStorage['gp-dayCount'] || 1;
    const hotel = localStorage['gp-hotel'] || 'hotels';
    const attractions = localStorage['gp-attractions'] ? JSON.parse(localStorage['gp-attractions']).join(', ') : ''; 
    let otherAttractions = localStorage['gp-other-attractions'] || ''; 
    if (otherAttractions) otherAttractions = otherAttractions.split(/\n|,/).filter(x => x.trim()).join(', '); 

    let firstTime = localStorage['gp-firstTime'] || '';
    if (firstTime) firstTime = 'a first time visitor to ';

    let travelWith = localStorage['gp-travelWith'] || '';
    if (travelWith) travelWith = ` with ${localStorage['gp-travelWith']}`;

    let occasion = localStorage['gp-occasion'] || '';
    if (occasion) occasion = ` for a ${localStorage['gp-occasion']}`;  

    return { city, days, dayCount, hotel, attractions, otherAttractions, firstTime, travelWith, occasion };
}

$gpScrollToTryOutBtn.addEventListener('click', e => {
    $gpTryOutRes.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
});

$gpTryOutPromptBtn.addEventListener('click', async e => {
    e.preventDefault();

    const prompt = $gpTryOutInp.value.trim();
    if (!prompt) return;

    const gpTryOutPromptBtnVal = $gpTryOutPromptBtn.value;
    $gpTryOutPromptBtn.value = 'Loading...';
    $gpTryOutRes.innerHTML = '';
    $gpTryOutRes.classList.add('spinner');

    const result = await postTextPrompt(prompt); 

    $gpTryOutRes.classList.remove('spinner');
    $gpTryOutRes.innerHTML = result.replace(/\*+/g, '<br>');
    $gpTryOutPromptBtn.value = gpTryOutPromptBtnVal;
});

async function postTextPrompt(prompt) {
    const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            payload: prompt,
            // tryOut: true,
        })
    });

    return res.text();
} 

$submitBtn.addEventListener('click', e => {
    e.preventDefault();
    handleSubmit();
});

async function handleSubmit() {
    const proceed = preprocess();
    console.log('proceed', proceed)
    if (!proceed) return;

    const submitBtnVal = $submitBtn.value;
    $submitBtn.value = 'Loading...';
    $result.innerHTML = '';
    $result.classList.add('spinner');

    const { prompt, displayPrompt, savePrompt } = generatePrompt();
    $prompt.textContent = displayPrompt; 
    $prompt.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    let result = await postPrompt(prompt); 

    let resultObj; 
    resultObj = isObject(checkJSON(result)) ? JSON.parse(result) : JSON.parse(result += '}'); // gemini been returning an unclosed parent object

    console.log('resultObj:::', resultObj)

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

    $result.classList.remove('spinner');
    $result.innerHTML = entireDayPlan; 
    $submitBtn.value = submitBtnVal;

    // document.querySelector('.gp-output-prompt-btn.edit').classList.remove('hide');
    // document.querySelector('.gp-output-prompt-btn.resubmit').classList.remove('hide');

    console.log('markers', markers)
    initMap(markers); 

    localStorage['gp-markers'] = JSON.stringify(markers2);

    // saveMarkerToFirebase(localStorage['gp-userMail'], markers); 
    // saveMarkersToFirebase(localStorage['gp-userMail'], markers2);

    saveMarkersNPromptToDB(userMail, savePrompt); 

    function preprocess() {
        const userMail = getUserMail(); 
        if (!userMail) return;

        const data = getUserMailData(userMail); 
        const { prompts } = data; 

        if ( prompts && prompts.length >= promptLimit ) {
            $maxedOutDisplay.classList.remove('hide');
            $maxedOutDisplay.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            const $form = document.querySelector('#wf-form-Trip-Name');
            $form.classList.add('shade');
            setTimeout(()=>$form.classList.remove('shade'),1000);
            return;
        }

        $maxedOutDisplay.classList.add('hide');
        
        if (!$tripName.value.trim() || !$travelDates.value.trim()) {
            if (!$tripName.value.trim()) {
                $tripName.classList.add('active');
                $tripName.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(()=>$tripName.classList.remove('active'),1000);
            }
            else {
                $travelDates.classList.add('active');
                $travelDates.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(()=>$travelDates.classList.remove('active'),1000);
            }

            return;
        }

        return true;
    }

    async function getUserMailData(userMail) {
        const userRef = doc(db, 'travelData', `user-${userMail}`); 
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            createUserInFirebase(userMail);
            return {}; 
        }
        return docSnap.data(); 
    }

    function isObject(obj) {
        return obj === Object(obj) && Object.prototype.toString.call(obj) !== '[object Array]';
    }

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

    async function saveMarkersNPromptToDB(userMail, savePrompt) {
        let markers = localStorage['gp-markers'];
        if (!markers) return;
    
        markers = JSON.parse(markers);
        await saveMarkersToFirebase(userMail, markers);
    
        const userRef = doc(db, 'travelData', `user-${userMail}`); 
        await updateDoc(userRef, { prompts: arrayUnion(savePrompt) }); // save prompt to db
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
}

function getUserMail() {
    return Clerk?.user?.externalAccounts?.[0]?.emailAddress || localStorage['gp-userMail'];
}

/*
!async function x() {
    const userRef = doc(db, 'travelData', `user-muijemuije24@gmail.com`); 
    const docSnap = await getDoc(userRef);
    const data = await docSnap.data(); 

    const { prompts } = data; 

    console.log('See prompts test:::', prompts)
}();
*/ 

// Google Map

// Initialize and add the map
const $map = document.querySelector('.gp-map');
let map;
let marker;
let infoWindow;

// initMap(); 

async function initMap(markers=[]) {
    // The map location
    const position = { lat: 40.706005, lng: -74.008827 };

    // Request needed libraries.
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
    //     google.maps.importLibrary("marker"),
    //     google.maps.importLibrary("places"),
    //   ]);
      

    // The map, centered at location
    // map = new Map($map, {
    map = new google.maps.Map($map, {
        zoom: 10,
        center: position,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
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

    /**
     * Autocomplete    
    */

    
}

!async function setupHotelAutocompleteInp() {
    await google.maps.importLibrary('places');

    // Create the input HTML element, and append it.
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: {country: ['us']},
    });

    // document.body.appendChild(placeAutocomplete); 
    const $hotelWrap = document.querySelector('.gp-hotel-inp');
    $hotelWrap.appendChild(placeAutocomplete);

    // Add the gmp-placeselect listener, and display the results.
    placeAutocomplete.addEventListener('gmp-placeselect', async ({ place }) => {
        await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location'],
        });

        const res = place.toJSON(); 
        const hotel = res.displayName;
        console.log(res);

        localStorage['gp-hotel'] = hotel;
    });
}(); 

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
    if (!userMail) return; 
    /*const userData = doc(db, 'travelData', `user-${userMail}`); 

    const querySnapshot = await getDocs(collection(db, 'travelData', `user-${userMail}`, 'tripNYC'));
    // const querySnapshot = collection(db, 'travelData', `user-${userMail}`, 'tripNYC');

    let obj;
    querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        console.log(doc.id, " => ", doc.data());
        obj = doc.data();
    });

    const userData2 = obj; // sortObject(obj);
    */

    // const docSnap = await getDoc(userData);

    // if (!docSnap.exists()) {
    //     const saveObj = {}; 
    //     saveObj.days = days;  
    //     saveObj.modifiedAt = serverTimestamp(); 
    //     await updateDoc(userData, saveObj);
        
    //     return; 
    // } 

    // const data = await docSnap.data(); 

    // let { days } = data; 

    // if (!days) days = [];


    let dbSubCollection = 'default_trip';

    if (localStorage['gp-trip-name']) {
        const tripName = localStorage['gp-trip-name'];
        dbSubCollection = tripName.replace(/([^a-z|0-9|-|'|~|\.|\!|\*|\(|\)]+)/igm, '_');
    }

    /*const city = localStorage['gp-city'] || '';
    let dbCol = 'tripNYC';

    if (city && city.toLowerCase().includes('dc')) {
        dbCol = 'tripDC';
    }*/

    const userRef = doc(db, 'travelData', `user-${userMail}`, dbSubCollection, 'doc1'); 

    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, { createdAt: serverTimestamp() }); 

        const userSubCollectionNamesRef = doc(db, 'travelData', `user-${userMail}`);
        await updateDoc(userSubCollectionNamesRef, { subNames: arrayUnion(dbSubCollection) }); 
    }

    // const data = await docSnap.data(); 

    /* async function createUserInFirebase(userMail) {
        if (!userMail) return;
        const userRef = doc(db, 'travelData', `user-${userMail}`);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) return;
        await setDoc(userRef, { createdAt: serverTimestamp() }); 
    } */

    const days = [];

    // console.log('markers:::::', markers)
    // console.log('days:::', days)

    markers.forEach(marker => {
        const { dayDate, morning, afternoon, evening } = marker;

        const morningEvent = {
            dayEventName: morning.placeName || '',
            title: morning.title || '',
            lat: morning.coordinates[0] || 0,
            lng: morning.coordinates[1] || 0,
            timeslot: 'morning',
        };
    
        const afternoonEvent = {
            dayEventName: afternoon.placeName || '',
            title: afternoon.title || '',
            lat: afternoon.coordinates[0] || 0,
            lng: afternoon.coordinates[1] || 0,
            timeslot: 'afternoon',
        };
    
        const eveningEvent = {
            dayEventName: evening.placeName || '',
            title: evening.title || '',
            lat: evening.coordinates[0] || 0,
            lng: evening.coordinates[1] || 0,
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
    // await updateDoc(userData, saveObj);
    // await updateDoc(querySnapshot, saveObj);
    await updateDoc(userRef, saveObj);
}

/*
const $promptEl = document.querySelector('.gp-prompt span');
const $editPromptInp = document.querySelector('.gp-edit-prompt');
const $editPromptBtn = document.querySelector('.gp-output-prompt-btn.edit');
const $resubmitPromptBtn = document.querySelector('.gp-output-prompt-btn.resubmit');

$editPromptBtn.addEventListener('click', e => {
    const prompt = $promptEl.textContent;
    $editPromptInp.value = prompt;
    $editPromptInp.classList.remove('hide');
    $resubmitPromptBtn.classList.remove('hide');
    $editPromptBtn.classList.add('hide');
});

$resubmitPromptBtn.addEventListener('click', async e => {
    let prompt = $editPromptInp.value.trim();

    $result.innerHTML = '';

    prompt = prompt.replace(/create a(.*?)day plan/i, `Create a ${localStorage['gp-days']} day plan`);   
    $promptEl.textContent = prompt;

    prompt = prompt + ` in the format
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
        }`;

    console.log('New Prompt:', prompt)

    let result = await postPrompt(prompt); 
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

        const obj = {
            dayDate: day,
            morning,
            afternoon,
            evening
        };

        markers2.push(obj);
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



    $editPromptInp.classList.add('hide');
    $resubmitPromptBtn.classList.add('hide');
    $editPromptBtn.classList.remove('hide');
});
*/

/*
// const $saveBtn = document.querySelector('.gp-save-btn');
const $saveBtn = document.querySelector('.gp-prompt-btn');
$saveBtn.addEventListener('click', async e => {
    e.preventDefault();

    const $saveBtn = e.currentTarget;
    // const saveBtnVal = $saveBtn.value;
    // $saveBtn.value = 'Saving...';

    let markers = localStorage['gp-markers'];
    if (!markers) return;

    if (!Clerk?.user) return; // not signed in

    const userMail = Clerk.user?.externalAccounts?.[0]?.emailAddress; // localStorage['gp-userMail'];
    if (!userMail) return;

    await createUserInFirebase( Clerk.user?.externalAccounts?.[0]?.emailAddress );

    markers = JSON.parse(markers);
    await saveMarkersToFirebase(userMail, markers);

    console.log('markers::::', markers)

    // $saveBtn.value = saveBtnVal; 
});
*/