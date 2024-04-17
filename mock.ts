let amount = 10000000000;
let feeRate = 1;
let feeAmount = (amount * feeRate) / 10000;
let rewardPercentage = 1200;
let rewardAmount = (feeAmount * rewardPercentage) / 10000;

// calculate the amount of tokens that the parent and grandparent and dibs platform will receive
let scale = 1e6;
let grandParentPercentage = 250000;
let dibsPercentage = 50000;
let grandParentAmount = (rewardAmount * grandParentPercentage) / scale;
let dibsAmount = (rewardAmount * dibsPercentage) / scale;
let parentAmount = rewardAmount - grandParentAmount - dibsAmount;

console.log(parentAmount);
