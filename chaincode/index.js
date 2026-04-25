'use strict';

const { Contract } = require('fabric-contract-api');

class BatchContract extends Contract {

    async CreateBatch(ctx, batchId, owner, quantity) {
        const exists = await ctx.stub.getState(batchId);

        if (exists && exists.length > 0) {
            throw new Error("Batch already exists");
        }

        const batch = {
            batchId,
            owner,
            quantity,
            status: "CREATED"
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    async ReadBatch(ctx, batchId) {
        const data = await ctx.stub.getState(batchId);

        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        return data.toString();
    }
}

module.exports.contracts = [BatchContract];