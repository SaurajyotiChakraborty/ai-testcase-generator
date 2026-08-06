/**
 * Runs a set of asynchronous tasks with a maximum concurrency limit.
 * @param {Array<Function>} taskGenerators Array of functions that return Promises
 * @param {number} concurrencyLimit Maximum number of tasks to run at once
 * @returns {Promise<Array>} Array of results in the same order as tasks
 */
async function runWithLimit(taskGenerators, concurrencyLimit = 3) {
    const results = new Array(taskGenerators.length);
    let currentIndex = 0;
    
    // A worker function that continually pulls the next task from the queue
    async function worker() {
        while (currentIndex < taskGenerators.length) {
            const index = currentIndex++;
            const task = taskGenerators[index];
            try {
                results[index] = await task();
            } catch (error) {
                // We capture the error but don't stop the other workers
                results[index] = { error };
            }
        }
    }
    
    // Start up to 'concurrencyLimit' workers
    const workers = [];
    for (let i = 0; i < concurrencyLimit && i < taskGenerators.length; i++) {
        workers.push(worker());
    }
    
    // Wait for all workers to finish
    await Promise.all(workers);
    
    return results;
}

module.exports = {
    runWithLimit
};
