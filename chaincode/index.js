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

    async CreateTransport(ctx, transportId, batchIdsJSON, startTime, location) {

        const exists = await ctx.stub.getState(transportId);
        if (exists && exists.length > 0) {
            throw new Error("Transport already exists");
        }

        const batchIds = JSON.parse(batchIdsJSON);

        const transport = {
            transportId,
            batchIds,
            startTime,
            startLocation: location,
            status: "IN_TRANSIT",
            trackingLogs: []
        };

        await ctx.stub.putState(transportId, Buffer.from(JSON.stringify(transport)));
        return JSON.stringify(transport);

    }

    async TrackCargo(ctx, transportId, temperature, speed, location, batchIdsJSON) {

        const data = await ctx.stub.getState(transportId);
        if (!data || data.length === 0) {
            throw new Error("Transport not found");
        }

        const transport = JSON.parse(data.toString());

        const batchIds = JSON.parse(batchIdsJSON);

        const txTime = ctx.stub.getTxTimestamp();
        const seconds = txTime.seconds.low;
        const nanos = txTime.nanos;

        const timestamp = new Date(seconds * 1000 + nanos / 1000000).toISOString();

        const log = {
            timestamp,
            temperature,
            speed,
            location,
            batchIds
        };

        transport.trackingLogs.push(log);

        await ctx.stub.putState(transportId, Buffer.from(JSON.stringify(transport)));

        return JSON.stringify(log);
    }

    async CompleteTransport(ctx, transportId, endLocation) {

        const data = await ctx.stub.getState(transportId);
        if (!data || data.length === 0) {
            throw new Error("Transport not found");
        }

        const transport = JSON.parse(data.toString());

        transport.status = "DELIVERED";
        transport.endLocation = endLocation;
        transport.endTime = new Date().toISOString();

        await ctx.stub.putState(transportId, Buffer.from(JSON.stringify(transport)));

        return JSON.stringify(transport);
    }

    async ReadTransport(ctx, transportId) {

        const data = await ctx.stub.getState(transportId);

        if (!data || data.length === 0) {
            throw new Error("Transport not found");
        }

        return data.toString();
    }
}

module.exports.contracts = [BatchContract];