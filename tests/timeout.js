
async function randomNormalTimeout(page, meanTimeout) {
    const rolls = 3; // Increase for a tighter concentration around the mean
    let sum = 0;
    for (let i = 0; i < rolls; i++) {
        sum += Math.random();
    }
    const randomNum = (sum / rolls) * 2;

    const timeoutDuration = randomNum * meanTimeout + 50;
    console.log(`Waiting for ${timeoutDuration} milliseconds.`);
    await page.waitForTimeout(timeoutDuration);
}


//console.log(getRandomWeightedTowardsCenter(1).toFixed(2));
let page;
randomNormalTimeout(page, 1500)