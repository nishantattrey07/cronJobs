const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Determines which founder record to keep based on data completeness
 * @param {string} id1 First founder ID
 * @param {string} id2 Second founder ID
 * @returns {Promise<string[]>} Array with [keepId, removeId]
 */
async function determineFounderToKeep(id1, id2) {
    const founder1 = await prisma.founder.findUnique({ where: { id: id1 } });
    const founder2 = await prisma.founder.findUnique({ where: { id: id2 } });

    // Count non-null fields to determine completeness
    const countNonNull = (obj) =>
        Object.values(obj).filter(val => val !== null && val !== undefined && val !== '').length;

    const completeness1 = countNonNull(founder1);
    const completeness2 = countNonNull(founder2);

    // Keep the more complete record, or the first one if equal
    return completeness1 >= completeness2 ? [id1, id2] : [id2, id1];
}

/**
 * Main deduplication function
 */
async function deduplicateFounders() {
    console.log('Starting founder deduplication process...');

    // Find potential duplicate founders
    console.log('Finding potential duplicates...');
    const potentialDuplicates = await prisma.$queryRaw`
    SELECT f1.id as id1, f2.id as id2, f1.name
    FROM "Founder" f1
    JOIN "Founder" f2 ON f1.name = f2.name AND f1.id != f2.id
    WHERE (
      (f1.linkedin IS NOT NULL AND f1.linkedin != '' AND f1.linkedin = f2.linkedin)
      OR (f1.twitter IS NOT NULL AND f1.twitter != '' AND f1.twitter = f2.twitter)
    )
  `;

    console.log(`Found ${potentialDuplicates.length} potential duplicate pairs`);

    // Track processed founders to avoid redundant operations
    const processedFounders = new Set();
    let mergedCount = 0;

    // Process each duplicate pair
    for (const pair of potentialDuplicates) {
        // Skip if either founder was already processed
        if (processedFounders.has(pair.id1) || processedFounders.has(pair.id2)) {
            continue;
        }

        console.log(`Processing duplicate: ${pair.name} (${pair.id1}, ${pair.id2})`);

        try {
            // Determine which founder to keep
            const [keepId, removeId] = await determineFounderToKeep(pair.id1, pair.id2);

            // Get company associations for the founder to be removed
            const companyAssociations = await prisma.companyFounder.findMany({
                where: { founderId: removeId }
            });

            console.log(`Found ${companyAssociations.length} company associations to migrate`);

            // For each company association, create or update in the keeper founder
            for (const assoc of companyAssociations) {
                // Check if association already exists for keeper
                const existingAssoc = await prisma.companyFounder.findFirst({
                    where: {
                        companyId: assoc.companyId,
                        founderId: keepId
                    }
                });

                if (!existingAssoc) {
                    // Create the association for the keeper
                    await prisma.companyFounder.create({
                        data: {
                            companyId: assoc.companyId,
                            founderId: keepId
                        }
                    });
                }
            }

            // Delete all company associations for the founder to be removed
            await prisma.companyFounder.deleteMany({
                where: { founderId: removeId }
            });

            // Delete the duplicate founder
            await prisma.founder.delete({
                where: { id: removeId }
            });

            // Mark both founders as processed
            processedFounders.add(pair.id1);
            processedFounders.add(pair.id2);
            mergedCount++;

            console.log(`Successfully merged founder ${pair.name} (kept ${keepId}, removed ${removeId})`);
        } catch (error) {
            console.error(`Error processing duplicate ${pair.name}:`, error);
        }
    }

    console.log(`Deduplication complete. Merged ${mergedCount} duplicate founders.`);
}

// Run the deduplication
deduplicateFounders()
    .catch(error => console.error('Deduplication process failed:', error))
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Disconnected from database');
    });