import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, 
    getDocs, updateDoc, deleteField, collection,
    arrayUnion, arrayRemove, serverTimestamp,
    query, where } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

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

let map, geocoder;
const $map = document.querySelector('.plan_map'),
    $address = document.querySelector('#Activity-Name'),  
    $daysSelect = document.querySelector('select#Day'), 
    $addDay = document.querySelector('.add-day'),
    $dayEvents = document.querySelector('.day-events'), 
    $logoutBtn = document.querySelector('[data-wf-user-logout="Log out"]'), 
    $popup = document.querySelector('.day-event .pop-up'),
    mapZoom = 13,
    initialCoords  = { lat: 40.7580, lng: -73.9855 },
    mapIcon = 'https://uploads-ssl.webflow.com/61268cc8812ac5956bad13e4/64ba87cd2730a9c6cf7c0d5a_pin%20(3).png', 
    directionsUrlBase = 'https://www.google.com/maps/dir/?api=1', 
    startingIndex = 0; 

// let currentDay = $daysSelect.options[$daysSelect.options.length-1]; // $daysSelect.options[startingIndex]; 
// currentDay.markers = [];
// currentDay currently assumes the user is coming in from the gemini page
// & so they already have a day or two populated

$daysSelect.selectedIndex = startingIndex;  

window.addEventListener('load', async () => {
    await Clerk.load();

    const clerkLoggedInMail = Clerk?.user?.emailAddresses?.[0]?.emailAddress;
    const wfLoggedInMail = localStorage['user-email'];  

    if (clerkLoggedInMail) localStorage['user-email'] = clerkLoggedInMail;

    console.log('clerkLoggedInMail:::::', clerkLoggedInMail)
    console.log('wfLoggedInMail:::::', wfLoggedInMail)

    const userMail = clerkLoggedInMail || wfLoggedInMail;
    // if (userMail) retrieveSavedMarkersFromFirebase(userMail); 
    if (userMail) retrieveSavedMarkersFromFirebase2(userMail); 
});

// google.maps.event.addDomListener(window, 'load', () => {
// }); 

$logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('user-email');
}); 

// setup map 
const icon = {
    url: mapIcon, //place.icon,
    size: new google.maps.Size(71, 71),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(17, 34),
    scaledSize: new google.maps.Size(25, 25),
};

const markerPopup = new google.maps.InfoWindow();  

!function initMap() {
    geocoder = new google.maps.Geocoder();
    map = new google.maps.Map($map, { 
        zoom: mapZoom,
        center: initialCoords,
    });

    // Create the search box and link it to the UI element.
    const searchBox = new google.maps.places.SearchBox($address);
    
    // Bias the SearchBox results towards current map's viewport 
    map.addListener('bounds_changed', () => {
        searchBox.setBounds(map.getBounds()); 
    });

    searchBox.addListener('places_changed', () => { 
        const places = searchBox.getPlaces();
    
        if (places.length == 0) return;
    
        // For each place, get the icon, name and location.
        const bounds = new google.maps.LatLngBounds();

        const numOfPlacesFound = places.length; 
        places.forEach((place) => {
            if (!place.geometry || !place.geometry.location) {
                alert('Sorry, try again\nNo cordinates found'); 
                return;
            }

            const marker = createMarker(place.name, place.geometry.location);  

            map.panTo(marker.position); 

            // console.log('currentDay on initMap:::', currentDay)  

            const currentDay = $daysSelect.selectedIndex !== 0 
                                ? $daysSelect.options[ $daysSelect.selectedIndex ] 
                                : $daysSelect.options[ $daysSelect.options.length-1 ];

            // console.log('$daysSelect.selectedIndex', $daysSelect.selectedIndex)
            // console.log('$daysSelect.options', $daysSelect.options)
            // console.log('$daysSelect.selectedIndex', $daysSelect.selectedIndex)
            // console.log('$daysSelect.options[ $daysSelect.selectedIndex ]', $daysSelect.options[ $daysSelect.selectedIndex ])
            // console.log('$daysSelect.options[ $daysSelect.options.length-1 ]', $daysSelect.options[ $daysSelect.options.length-1 ])
            // console.log('currentDay', currentDay)


            currentDay.markers = [];
            currentDay.markers.push(marker);

            const dayNum = getCurrentDayNum(); 
            const day = `[day="${currentDay.value}"]`; // `.day-${dayNum}-event`;    
            $dayEvents.querySelector(`${day} .single-event`)?.classList.add('hide'); 

            const lat = marker.position.lat();
            const lng = marker.position.lng();
            const title = marker.title; 
 
            const markerObj = {lat, lng, title}; 

            $address.n = ($address.n || 1) + 1; 

            let idNum = 2; 
            const lastId = $dayEvents.querySelector(`${day} > .single-event:last-child:not(.hide)`)?.id;
            if (lastId) {
                let num = Number(lastId.split('-')[0].slice(-1));  
                num += 1;
                idNum = num; 
            }

            let dayEventName = ''; 
            if (numOfPlacesFound > 1) {
                const addressName = `${place.name} ${place.formatted_address}`; 
                dayEventName = addressName; 
                postDayEvent(addressName, day, marker, `event${idNum}-day${dayNum}`, {lat, lng, title, dayEventName});
            }
            else {
                dayEventName = $address.value; 
                postDayEvent($address.value, day, marker, `event${idNum}-day${dayNum}`, {lat, lng, title, dayEventName});
            }

            markerObj.dayEventName = dayEventName;             

            const userMail = localStorage.getItem('user-email');
            if (userMail) saveMarkerToFirebase(userMail, dayNum, markerObj);  

        });

        $address.value = '';  
    });

    if (!localStorage['gp-attractions']) return; 
    JSON.parse(localStorage['gp-attractions']).forEach(attraction => {
        codeAddress(attraction);
    });
}();

function createMarker(title, position) {
    const marker = new google.maps.Marker({
        map,
        icon,
        title, 
        position,  
    });

    marker.addListener('click', () => { 
        markerPopup.close();
        markerPopup.setContent(marker.getTitle());
        markerPopup.open(marker.getMap(), marker);
    });

    return marker; 
} 

function codeAddress(address) {
    // var address = document.getElementById('address').value;
    geocoder.geocode( { 'address': address}, function(results, status) {
      if (status == 'OK') {
        map.setCenter(results[0].geometry.location);

        /*var marker = new google.maps.Marker({
            map: map,
            position: results[0].geometry.location
        });*/

        createMarker(address, results[0].geometry.location);

      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    });
}

function postDayEvent(dayEventTxt, day, marker, eventId, markerObj) {
    const $day = $dayEvents.querySelector(day);  
    if ($day) {
        constructEvent(dayEventTxt, day, marker, eventId, markerObj); 
    }
    else {
        const dayNum = day.split('-')[1]; 
        // addDayEventList(dayNum); 
        constructEvent(dayEventTxt, day, marker, eventId, markerObj); 

        if ($dayEvents.querySelector(`.day-${dayNum}-event`)) {

            // const $hiddenEvent = $dayEvents.querySelector(`.day-${dayNum}-event`).querySelector('.single-event');
            const $hiddenEvent = $dayEvents.querySelector(`.day-${dayNum}-event > .single-event`);  

            $hiddenEvent.classList.add('hide'); 
            $hiddenEvent.id = `event-${dayNum}`;
        }  
    }
}


function constructEvent(dayEventTxt, day, marker, eventId, markerObj) {
    const $day = $dayEvents.querySelector(day); 

    // console.log('day:::', day)
    // console.log('$day:::', $day)

    const $allEvents = $day.querySelector('.all-events'); 

    const $dayEvent = $dayEvents.querySelector(`${day} > .single-event`).cloneNode(true);  
    // const $dayEvent = $day.querySelector('.single-event').cloneNode(true);   
    $dayEvent.classList.remove('hide'); 
    $dayEvent.id = eventId;
    $dayEvent.querySelector('.remove-marker').classList.remove('hide'); 
    $dayEvent.querySelector('.get-directions').classList.remove('hide'); 
    $dayEvent.querySelector('.day-text').textContent = dayEventTxt;
    $dayEvent.marker = marker; 
    $dayEvent.markerObj = markerObj;
    $dayEvent.addEventListener('mouseover', e => {
        const $event = e.currentTarget; 
        $event.setAttribute('title', $event.querySelector('.day-text').textContent);  
    });

    $allEvents.append($dayEvent); 

    // $day.append($allEvents);   
}

$addDay.addEventListener('click', e => {
    const $addDayBtn = e.currentTarget;
    const dayNum = updateDayNum($addDayBtn); 
    // currentDay = addOptionToDaysSelect(dayNum); 

    const daysSelectOptions = $daysSelect.querySelectorAll('option');
    const lastOption = daysSelectOptions[daysSelectOptions.length-1];
    const lastDate = new Date(lastOption.value.trim());
    if (lastDate.toString().toLowerCase() === 'invalid date') return;
    let newDate = new Date(lastDate);
    newDate.setDate( newDate.getDate() + 1 );
    newDate = newDate.toDateString();
    newDate = `${newDate.substring(0,3)}, ${newDate.substring(4)}`;

    const currentDay = addOptionToDaysSelect2(newDate); 
    currentDay.markers = []; 
    $address.value = '';  

    $daysSelect.selectedIndex = $daysSelect.querySelectorAll('option').length - 1;

    $dayEvents.querySelectorAll('.day-event').forEach(day => day.classList.add('hide')); 

    addDayEventList(newDate); 

    const userMail = localStorage.getItem('user-email'); 
    if (userMail) addDayToFirebase(userMail, dayNum); 
});

async function addDayToFirebase(userMail, dayNum) {  
    const existingMarkers = doc(db, 'Locations', `User-${userMail}`);
    const dayObj = {};
    const underscores = dayNum.toString().split('').map(_ => '_').join('');  
    dayObj[`${underscores}Day${dayNum}`] = [];  
    dayObj.ModifiedAt = serverTimestamp(); 

    await updateDoc(existingMarkers, dayObj); 
}


function updateDayNum($addDayBtn) {
    const dayNum = ($addDayBtn.dayNum || 1) + 1;
    $addDayBtn.dayNum = dayNum;  
    return dayNum; 
} 

function addOptionToDaysSelect(dayNum) {
    const $option = document.createElement('option');
    $option.setAttribute('value', `day-${dayNum}`);
    $option.textContent = `Day ${dayNum}`;  
    $daysSelect.append($option); 
    $daysSelect.value = `day-${dayNum}`; 
    return $option; 
}

function addDayEventList(dayDate) {
    const $dayEvent = $dayEvents.children[0].cloneNode(true);

    $dayEvent.classList.remove('day-1-event');
    $dayEvent.classList.remove('hidden');

    // $dayEvent.classList.add(`day-${dayNum}-event`);
    $dayEvent.setAttribute('day', dayDate); 
    
    $dayEvent.querySelector('.day-head').textContent = dayDate; // `Day ${dayNum}`; 

    if ($dayEvent.querySelector('.single-event.hide'))   {
        $dayEvent.querySelectorAll('.single-event:not(.hide)').forEach(el => el.remove()); 
        $dayEvent.querySelector('.single-event.hide').classList.remove('hide'); 
    }

    $dayEvent.querySelector('.remove-marker').classList.add('hide');
    $dayEvent.querySelector('.get-directions').classList.add('hide');
    
    $dayEvent.classList.remove('hide');   
    // $dayEvents.insertBefore($dayEvent, $dayEvents.querySelector(`.day-${dayNum+1}-event`)); 
    $dayEvents.append($dayEvent);
}

function getCurrentDayNum() {
    const dayNum = $daysSelect.selectedIndex !== 0 ? $daysSelect.selectedIndex : $daysSelect.options.length - 1;  
    return dayNum; 
} 

$daysSelect.addEventListener('change', e => {
    const $select = e.currentTarget; 
    let index = $select.selectedIndex; 

    // const addDay = $select.options[$select.options.length - 1].index;
    // if (index === addDay) return;

    if (index !== 0) {
        // hideAllDayEvents(); 
        $dayEvents.querySelectorAll('.day-event').forEach(day => {
            day.classList.add('hide'); 
            hideMarkers(day); 
        }); 

        const selectedDay = $select.value.trim();
        const $chosenDay = $dayEvents.querySelector(`.day-event[day='${selectedDay}']`);

        // console.log('selectedDay', selectedDay)
        // console.log('$chosenDay', $chosenDay)
        
        // const $chosenDay = document.querySelector(`.day-event.day-${index}-event`); 
        if ($chosenDay) {
            $chosenDay.classList.remove('hide'); 
            const $dayEvent = $chosenDay; // .closest('.day-event'); 
            if ($dayEvent.querySelector('.single-event').length === 1) {
                $dayEvent.querySelector('.single-event.hide')?.classList.remove('hide'); 
                $dayEvent.querySelector('.remove-marker')?.classList.add('hide');
                $dayEvent.querySelector('.get-directions')?.classList.add('hide');
            }
            showMarkers($chosenDay); 
        }
        /*else {
            const dayNum = index; 
            addDayActivitiesListContainer(selectedDay); 
        }*/
    }
    else {
        index = $select.options.length - 1; 
        $dayEvents
        // .querySelector('.all-days')
        .querySelectorAll('.day-event').forEach(day => day.classList.remove('hide')); 
        showAllMarkers(); 
    }
    
    // currentDay = $select.options[ index ];   
});  

/*
$daysSelect.addEventListener('change', e => {
    const $select = e.currentTarget; 
    let index = $select.selectedIndex; 
    if (index !== 0) {
        $dayEvents.querySelectorAll('.day-event').forEach(day => {
            day.classList.add('hide'); 
            hideMarkers(day); 
        }); 
        
        const $chosenDay = document.querySelector(`.day-event.day-${index}-event`); 
        if ($chosenDay) {
            $chosenDay.classList.remove('hide'); 
            const $dayEvent = $chosenDay.closest('.day-event'); 
            if ($dayEvent.querySelector('.single-event').length === 1) {
                $dayEvent.querySelector('.single-event.hide')?.classList.remove('hide'); 
                $dayEvent.querySelector('.remove-marker')?.classList.add('hide');
                $dayEvent.querySelector('.get-directions')?.classList.add('hide');
            }
            showMarkers($chosenDay); 
        }
        else {
            const dayNum = index; 
            addDayEventList(dayNum); 
        }
    }
    else {
        index = $select.options.length - 1; 
        $dayEvents.querySelectorAll('.day-event').forEach(day => day.classList.remove('hide')); 
        showAllMarkers(); 
    }
    currentDay = $select.options[ index ];   
});  
*/

function showAllMarkers() {
    $dayEvents.querySelectorAll('.day-event').forEach(day => showMarkers(day)); 
}

function showMarkers(day) {
    day.querySelectorAll('.single-event:not(.hide)').forEach(dayEvent => dayEvent.marker?.setMap(map));
}

function hideMarkers(day) {
    day.querySelectorAll('.single-event:not(.hide)').forEach(dayEvent => dayEvent.marker?.setMap(null));
}

$dayEvents.addEventListener('click', e => {
    if (!e.target.closest('.map_sort-button')) return; 

    const dayNum = [...$dayEvents.querySelectorAll('.day-event')].indexOf(e.target.closest('.day-event'));
    if (dayNum !== 0) {
        $dayEvents.dayNum = dayNum;
        $dayEvents.querySelector('.day-event .map_sort-button').click();
        return;
    }

    const $dayEvent = e.isTrusted ? $dayEvents.children[0] : $dayEvents.children[$dayEvents.dayNum];
    const $allEvents = $dayEvent.querySelector('.all-events'); 
    const $allEventsClone = $allEvents.cloneNode(true);

    const $firstDayEvent = $dayEvents.children[0]; 
    const $modal = $firstDayEvent.querySelector('.pop-up');
    const $modalContent = $modal.querySelector('.pop-up_item');   
    const $close = $modal.querySelector('.cross_icon'); 
    const $sortIcon = $modal.querySelector('.sort');

    const $allEventsDayEvents = $allEvents.querySelectorAll('.single-event'); 
    $allEventsClone.querySelectorAll('.single-event').forEach((dayEvent, i) => {
        if (!dayEvent.querySelector('.sort')) dayEvent.querySelector('.day-item').prepend($sortIcon.cloneNode(true));
        dayEvent.marker = $allEventsDayEvents[i].marker;
        dayEvent.markerObj = $allEventsDayEvents[i].markerObj;
    });

    $modalContent.append($allEventsClone); 

    $modalContent.querySelector('.single-event').classList.add('hide');  

    $close.addEventListener('click', e => {
        const $closeBtn = e.currentTarget; 
        const $sortedEvents = $closeBtn.closest('.pop-up_item').querySelector('.all-events');
        $allEvents.replaceWith($sortedEvents);
    }); 

    $modal.addEventListener('click', e => { 
        if (e.target !== $modal) return;    
        const $sortedEvents = e.target.querySelector('.all-events');
        $allEvents.replaceWith($sortedEvents);
        $close.click(); 
    });
    
});

$dayEvents.addEventListener('click', e => {
    if (e.target.closest('.remove-marker')) {
        const $removeMarker = e.target; 
        const $event = $removeMarker.closest('.single-event'); 
        const $dayEvent = $removeMarker.closest('.day-event');
        const eventNum = $dayEvent.querySelectorAll('.single-event:not(.hide)').length; 
        
        removeMarker($event, $removeMarker); 
        if ($dayEvent.querySelectorAll('.single-event').length > 1) $event.remove(); 

        if (eventNum == 1) {
            $dayEvent.querySelector('.single-event.hide')?.classList.remove('hide'); 
            if ( Number( $dayEvent.querySelector('.day-head').textContent.slice(-1) ) !== 1 ) {
                $dayEvent.classList.add('hide'); 
            }
        }
    } 
    else if (e.target.closest('.get-directions')) {    
        const $getDir = e.target;   
        const $event = $getDir.closest('.single-event');  

        const prevLat = $event.previousElementSibling.marker?.position.lat();
        const prevLng = $event.previousElementSibling.marker?.position.lng();

        const destinationLat = $event.marker.position?.lat() || $event.marker.lat;
        const destinationLng = $event.marker.position?.lng() || $event.marker.lng; 

        if (prevLat && prevLng) {
            const url = `${directionsUrlBase}&origin=${prevLat},${prevLng}&destination=${destinationLat},${destinationLng}`;  
            window.open(url); 
        }
    }
});  

function removeMarker($event, $removeMarker) {
    $event.marker?.setMap(null); 
    const dayNum = $removeMarker.closest('.day-event').querySelector('.day-head').textContent.slice(-1); 
    const currentDayMarkers = $daysSelect.options[$daysSelect.selectedIndex].markers; // $daysSelect.options[dayNum].markers;
    if (currentDayMarkers) currentDayMarkers.splice(currentDayMarkers.indexOf($event.marker), 1);   

    const userMail = localStorage.getItem('user-email');   
    if (userMail) removeFirebaseSavedMarker(userMail, dayNum, $event);  
}    


!async function createUserInFirebase(userMail) {
    const userRef = doc(db, 'Locations', `User-${userMail}`);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() || !userMail) return;
    await setDoc(userRef, { CreatedAt: serverTimestamp() }); 
}(localStorage.getItem('user-email')); 
 

async function saveMarkerToFirebase(userMail, dayNum, markerObj) {  
    const existingMarkers = doc(db, 'Locations', `User-${userMail}`);
    const dayObj = {};
    const underscores = dayNum.toString().split('').map(_ => '_').join('');  
    dayObj[`${underscores}Day${dayNum}`] = arrayUnion(markerObj); 
    dayObj.ModifiedAt = serverTimestamp(); 

    await updateDoc(existingMarkers, dayObj);
}

// retrieveSavedMarkersFromFirebase2(localStorage['user-email']); 

const $tripDropdown = document.querySelector('.gp-trip-select-options');
const $tripNameDisplay = document.querySelector('.gp-trip-select-val');

$tripDropdown.addEventListener('click', async e => {
    if (!e.target.closest('.w-dropdown-link')) return;
    const $link = e.target.closest('.w-dropdown-link');
    const tripName = $link.textContent;
    $tripNameDisplay.textContent = tripName;
    const userMail = localStorage['user-email'];
    await retrieveSavedMarkersFromFirebase2(userMail, tripName.replaceAll(' ', '_'));
});

async function retrieveSavedMarkersFromFirebase2(userMail, changeTrip=false) {

    // Implement getting docs from cache
    // https://firebase.google.com/docs/firestore/query-data/get-data#source_options

    /*const docRef = doc(db, 'travelData', `user-${userMail}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        // docSnap.data() will be undefined in this case
        console.log('No user with such email!');
        return; 
    } 

    const userData = sortObject(docSnap.data());*/

    // console.log('userMail', userMail)
    // console.log('docRef', docRef)
    // console.log('docSnap', docSnap)
    // console.log('userData:', docSnap.data())  

    async function populateTripsDropdown() {
        const $tripDropdown = document.querySelector('.gp-trip-select-options');
        const $tripDropdownLink = $tripDropdown.querySelector('.w-dropdown-link');
        const $tripNameDisplay = document.querySelector('.gp-trip-select-val');

        const docRef = doc(db, 'travelData', `user-${userMail}`);
        const docSnap = await getDoc(docRef);
        const tripData = sortObject(docSnap.data());
        const tripNames = tripData.subNames;

        tripNames.forEach((tripName, n) => {
            tripName = tripName.replaceAll('_', ' ');
            const $linkClone = $tripDropdownLink.cloneNode(true);
            $linkClone.textContent = tripName;
            $linkClone.classList.remove('hidden');
            $tripDropdown.append($linkClone);
            if (n !== 0) return;
            $tripNameDisplay.textContent = tripName;
        });

        return tripNames[0];
    }

    let currentTrip;

    if (changeTrip) {
        currentTrip = changeTrip; 
    }  
    else {
        currentTrip = await populateTripsDropdown();
    }

    /*const city = localStorage['gp-city'] || '';
    let dbCol = 'tripNYC';

    if (city && city.toLowerCase().includes('dc')) {
        dbCol = 'tripDC';
    }*/

    const querySnapshot = await getDocs(collection(db, 'travelData', `user-${userMail}`, currentTrip));
    let obj;
    querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    // console.log(doc.id, " => ", doc.data());
    obj = doc.data();
    });

    const userData2 = sortObject(obj); 

    console.log('userData2', userData2)

    // const colRef = await collection(db, 'travelData'); // , `user-${userMail}`);

    // console.log('colRef', colRef)

    // const q = query(colRef, where("state", "==", "CA"));

    const { days } = userData2;

    if (!days) return;

    $dayEvents.querySelectorAll('.day-event:not(.hidden)').forEach(day => day.remove());

    days.forEach(day => {
        const { dayDate, events:dayActivities } = day;
        const dayIdentifier = `[day="${dayDate.trim()}"]`;

        addDayActivitiesListContainer(dayDate);
        // addOptionToDaysSelect(dayDate);
        addOptionToDaysSelect2(dayDate);

        const $parentContainer = document.querySelector('.day-events');

        dayActivities.forEach(activity => {
            const $currentDay = $parentContainer.querySelector(dayIdentifier);

            // console.log('$currentDay', $currentDay)

            if (!$currentDay) return;

            const { dayEventName, description, lat, lng, title, timeslot, starttime, endtime, 
                rating, reviews, operatingHours, phoneNumber, address } = activity;
            if (lat && lng) {
                const locationInfo = {
                    name: dayEventName, // has the actual place's name
                    latLng: {lat, lng},
                    rating,
                    reviews,
                    operatingHours,
                    phoneNumber,
                    address,
                };

                const { marker } = createMarker(dayEventName, {lat, lng}); // createMarker(locationInfo);   

                // console.log('marker', marker)  

                // currentDay.markers.push(marker);  

                const markerObj = { lat, lng, title, dayEventName, description, timeslot, starttime, endtime }; 

                const eventId = dayDate.toLowerCase().replace(/,\s+|\s+/g,'-');
                // postDayActivity(dayEventName, dayIdentifier, marker, eventId, markerObj); 
                postDayEvent(dayEventName, dayIdentifier, marker, eventId, markerObj); 
            }
        });
    });

    function sortObject(obj) {
        return Object.keys(obj).sort().reduce((result, key) => {   
            result[key] = obj[key];
            return result;
        }, {});
    }
}

/*async function retrieveSavedMarkersFromFirebase(userMail) {
    const docRef = doc(db, 'Locations', `User-${userMail}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        // docSnap.data() will be undefined in this case
        console.log('No user with such email!');
        return; 
    } 

    const userData = sortObject(docSnap.data());

    for (let [day, locations] of Object.entries(userData)) {
        if (!day.startsWith('_')) continue;

        const dayNum = Number(day.split('Day')[1]);  

        if (dayNum === 1) {
            currentDay = $daysSelect.options[1]; 
            currentDay.markers = currentDay.markers || []; 
            $addDay.dayNum = 1; 
        }
        else {  
            currentDay = addOptionToDaysSelect(dayNum);  
            currentDay.markers = currentDay.markers || []; 
            $addDay.dayNum = dayNum;
        }

        locations.forEach((location, eventNum) => {
            const dayClass = `.day-${dayNum}-event`; 
            const $currentDay = $dayEvents.querySelector(dayClass); 

            const { lat, lng, title, dayEventName } = location;
            if (lat && lng) {
                const createdMarker = createMarker(title, {lat, lng});   
                currentDay.markers.push(createdMarker);  
                postDayEvent(dayEventName, dayClass, createdMarker, `event${(eventNum+2)}-day${dayNum}`, {lat, lng, title, dayEventName}); 
            }

            if ($currentDay && $currentDay.querySelectorAll('.single-event').length > 1) $dayEvents.querySelector(`${dayClass} .single-event`).classList.add('hide');  
        });

    }

    $daysSelect.selectedIndex = 0; 

    function sortObject(obj) {
        return Object.keys(obj).sort().reduce((result, key) => {   
            result[key] = obj[key];
            return result;
        }, {});
    }
}*/

function addOptionToDaysSelect2(val) {
    const $option = document.createElement('option');
    // $option.setAttribute('value', `day-${dayNum}`);
    $option.setAttribute('value', val);
    $option.textContent = val; //`Day ${dayNum}`;  
    $daysSelect.append($option); 
    // $daysSelect.insertBefore($option, document.querySelector('.add-day-option'));
    // $daysSelect.value = val; 
    return $option; 
}

function addDayActivitiesListContainer(dayDate, parenDiv='.day-events') {
    // const $dayEvent = $dayEvents.querySelector('[data-clone="day-event"]').cloneNode(true);
    const $dayEvent = $dayEvents.querySelector('.day-event').cloneNode(true);
    
    $dayEvent.classList.remove('day-0-event');
    $dayEvent.classList.remove('day-1-event');
    $dayEvent.classList.remove('hidden');
    // $dayEvent.classList.add(`day-${dayNum}-event`);
    $dayEvent.setAttribute('day', dayDate);
    $dayEvent.querySelector('.day-head').textContent = dayDate; // headerText; //`Day ${dayNum}`; 
    // $dayEvent.setAttribute('day', headerText);

    if ($dayEvent.querySelector('.single-event.hide'))   {
        $dayEvent.querySelectorAll('.single-event:not(.hide)').forEach(el => el.remove()); 
        $dayEvent.querySelector('.single-event.hide').classList.remove('hide'); 
    }

    // $dayEvent.querySelector('.all-days').innerHTML = '';

    // $dayEvent.querySelectorAll('.map_list-icon').forEach(icon => icon.classList.add('hide')); 

    $dayEvent.querySelector('.remove-marker').classList.add('hide');
    $dayEvent.querySelector('.get-directions').classList.add('hide');
    
    $dayEvent.classList.remove('hide');  

    // $dayEvent.querySelector('.single-event').classList.add('hide');

    console.log('the parenDiv', parenDiv)

    const $parent = $dayEvents//.querySelector(parenDiv);
    $parent.append($dayEvent);
    // $parent.insertBefore($dayEvent, $dayEvents.querySelector(`.day-${dayNum+1}-event`)); 

    if (!$parent.classList.contains('all-days')) return;
    $noDays.classList.add('hide');
}

async function removeFirebaseSavedMarker(userMail, dayNum, $event) {
    const dayEventRef = doc(db, 'Locations', `User-${userMail}`);
    const dayObj = {};
    dayObj[`_Day${dayNum}`] = arrayRemove($event.markerObj); 
    await updateDoc(dayEventRef, dayObj);  
}  

if (!navigator.userAgent.match(/Mobile|Windows Phone|Lumia|Android|webOS|iPhone|iPod|Blackberry|PlayBook|BB10|Opera Mini|\bCrMo\/|Opera Mobi|Tablet|iPad/i) ) {
    $dayEvents.addEventListener('drag', e => {
        if (e.target.closest('.single-event')) {
            const selectedItem = e.target.closest('.single-event'),
                    list = selectedItem.parentNode,
                    x = e.clientX,
                    y = e.clientY;
            
            selectedItem.classList.add('drag-sort-active');
            let swapItem = document.elementFromPoint(x, y) === null ? selectedItem : document.elementFromPoint(x, y);
    
            if (list === swapItem.closest('.all-events')) {
                swapItem = swapItem.closest('.single-event');             
                if ( swapItem === selectedItem.nextSibling ) {
                    swapItem = swapItem?.nextSibling;
                }
                else {
                    swapItem = swapItem; 
                }       
                list.insertBefore(selectedItem, swapItem);  
            }
        } 
    });
    
    $dayEvents.addEventListener('dragend', e => {
        if (e.target.closest('.single-event')) {
            const $dayEvent = e.target.closest('.single-event'); 
            $dayEvent.classList.remove('drag-sort-active');
    
            updateFirebaseAfterSort($dayEvent);     
        }
    });  
}

$dayEvents.addEventListener('touchmove', e => {
    if ($popup.style.display === 'none') return; 
    if (!e.target.closest('.single-event')) return; 
    const selectedItem = e.target.closest('.single-event'),
            list = selectedItem.parentNode,
            x = e.touches[0].clientX,
            y = e.touches[0].clientY;
    
    selectedItem.classList.add('drag-sort-active-mobile'); 
    let swapItem = document.elementFromPoint(x, y) === null ? selectedItem : document.elementFromPoint(x, y);
    
    if (list === swapItem.closest('.all-events')) {
        swapItem = swapItem.closest('.single-event');             
        if ( swapItem === selectedItem.nextSibling ) {
            swapItem = swapItem?.nextSibling;
        }
        else {
            swapItem = swapItem; 
        }       
        list.insertBefore(selectedItem, swapItem);  
    } 
});

$dayEvents.addEventListener('touchend', e => {
    if (!e.target.closest('.single-event')) return;
    const $dayEvent = e.target.closest('.single-event'); 
    $dayEvent.classList.remove('drag-sort-active-mobile');

    updateFirebaseAfterSort($dayEvent);  
}); 

async function updateFirebaseAfterSort($dayEvent) {
    const dayNum = $dayEvent.id.slice(-1); 
    const userMail = localStorage.getItem('user-email');

    const eventsArr = [...$dayEvent.closest('.all-events').querySelectorAll('.single-event')].map(dayEvent => {
        return dayEvent.markerObj;
    });

    const dayEventRef = doc(db, 'Locations', `User-${userMail}`);
    const dayObj = {};
    dayObj[`_Day${dayNum}`] = eventsArr; 
    await updateDoc(dayEventRef, dayObj); 
} 