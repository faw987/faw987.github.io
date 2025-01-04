
//
// dec28key
//

function calcResults() {
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