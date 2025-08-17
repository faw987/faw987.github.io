// Converts Celsius to Fahrenheit
function cToF(c) {
    return Math.round((c * 9/5) + 32);
}

// Converts mm to inches (not always provided by NWS, but left for consistency)
function mmToIn(mm) {
    return +(mm / 25.4).toFixed(2);
}