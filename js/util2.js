// Converts Kelvin to Fahrenheit
function kelvinToF(kelvin) {
    return Math.round((kelvin - 273.15) * 9/5 + 32);
}

// Converts mm to inches
function mmToIn(mm) {
    return +(mm / 25.4).toFixed(2);
}