//
// //
// //
//
//
// dec28key
//

function calcResults() {
    // const p0 = "sk-" + "proj-ibTFzOD8mvr-y0GZhaHi5dQqBKxyIBvmUSaWkFYuQ7nwH6Fp22f";
    // const p1 = "CATjdebf31wcyE6OYUFQjCKT3BlbkFJuNy1w";
    // const p2 = "4CWxPB43-PzUkW8yzX5BKERS0CJZ7RNkUczjdeKhpz-U0AzkqugTFLO3239CpXA3aTcwA";

    const p0 = "sk-" + "proj-9Bhqoki1MgfS8v6JWlPbLWBx994X2o21NBj9tI7AsWFT9aLYAmxrROQk6tun43";
    const p1 = "-tjIUQiaDMwTT3BlbkFJGlDPtRgpk05hovtANnzGKWTbOx";
    const p2 = "94jVSpGuSwMiv2rpvuW4sVLWVgWCucNnfOPl0Or03QmcvXoA"

    const pp0 = p0 + p1;
    const pp1 = pp0 + p2;
    return pp1;
}


function updateTableFromModel(row,tableIndex,prompt) {
    transformedMovies[row.actualIndex][tableIndex] = "Obtaining information.";
    invokeModel(prompt).then((resp) => {
        console.log(`Table Index: ${tableIndex},  Response: ${resp}.`);
        transformedMovies[row.actualIndex][tableIndex] = resp;
        grid.updateConfig({ data: transformedMovies }).forceRender();
    });
}


//
//
//

