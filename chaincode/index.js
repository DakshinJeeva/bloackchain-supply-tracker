'use strict';

const { Contract } = require('fabric-contract-api');

class BatchContract extends Contract {

    // ========================
    // STEP 1: COLLECTION
    // ========================
    async CreateBatch(ctx, batchId, type, location, dateTime, photo) {

        const exists = await ctx.stub.getState(batchId);
        if (exists && exists.length > 0) {
            throw new Error("Batch already exists");
        }

        const batch = {
            batchId,
            collection: {
                type,
                location,
                dateTime,
                photo
            },
            drying: {},
            mixing: {},
            product: {}
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    // ========================
    // STEP 2: DRYING
    // ========================
    async AddDrying(ctx, batchId, temperature, duration, dateTime) {

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        batch.drying = {
            temperature,
            duration,
            dateTime
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    // ========================
    // STEP 3: MIXING
    // ========================
    async AddMixing(ctx, batchId, temperature, ingredients, dateTime) {

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        batch.mixing = {
            temperature,
            ingredients,
            dateTime
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    // ========================
    // STEP 4: PRODUCT MAKING
    // ========================
    async AddProduct(ctx, batchId, photo, dateTime) {

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        batch.product = {
            photo,
            dateTime
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    // ========================
    // QUERY
    // ========================
    async ReadBatch(ctx, batchId) {

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        return data.toString();
    }
}

module.exports.contracts = [BatchContract];