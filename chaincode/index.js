'use strict';

const { Contract } = require('fabric-contract-api');

// Validate that a value is a well-formed email address (Google OAuth supports
// institutional domains, not just @gmail.com)
function assertEmail(email, label) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`${label} must be a valid email address (got: "${email}")`);
    }
}

class BatchContract extends Contract {

    // ========================
    // STEP 1: COLLECTION
    // ========================
    async CreateBatch(ctx, batchId, type, location, dateTime, photo, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

        const exists = await ctx.stub.getState(batchId);
        if (exists && exists.length > 0) {
            throw new Error("Batch already exists");
        }

        const txMeta = {
            initiatedBy,
            carriedBy,
            txId: ctx.stub.getTxID(),
            timestamp: (() => {
                const t = ctx.stub.getTxTimestamp();
                return new Date(t.seconds.low * 1000 + t.nanos / 1000000).toISOString();
            })()
        };

        const batch = {
            batchId,
            collection: {
                type,
                location,
                dateTime,
                photo,
                txMeta
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
    async AddDrying(ctx, batchId, temperature, duration, dateTime, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        const txMeta = {
            initiatedBy,
            carriedBy,
            txId: ctx.stub.getTxID(),
            timestamp: (() => {
                const t = ctx.stub.getTxTimestamp();
                return new Date(t.seconds.low * 1000 + t.nanos / 1000000).toISOString();
            })()
        };

        batch.drying = {
            temperature,
            duration,
            dateTime,
            txMeta
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    // ========================
    // STEP 3: MIXING
    // ========================
    async AddMixing(ctx, batchId, temperature, ingredients, dateTime, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        const txMeta = {
            initiatedBy,
            carriedBy,
            txId: ctx.stub.getTxID(),
            timestamp: (() => {
                const t = ctx.stub.getTxTimestamp();
                return new Date(t.seconds.low * 1000 + t.nanos / 1000000).toISOString();
            })()
        };

        batch.mixing = {
            temperature,
            ingredients,
            dateTime,
            txMeta
        };

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(batch)));
        return JSON.stringify(batch);
    }

    // ========================
    // STEP 4: PRODUCT MAKING
    // ========================
    async AddProduct(ctx, batchId, photo, dateTime, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        const txMeta = {
            initiatedBy,
            carriedBy,
            txId: ctx.stub.getTxID(),
            timestamp: (() => {
                const t = ctx.stub.getTxTimestamp();
                return new Date(t.seconds.low * 1000 + t.nanos / 1000000).toISOString();
            })()
        };

        batch.product = {
            photo,
            dateTime,
            txMeta
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

    // ========================
    // TRANSPORT
    // ========================
    async CreateTransport(ctx, transportId, batchIdsJSON, startTime, location, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

        const exists = await ctx.stub.getState(transportId);
        if (exists && exists.length > 0) {
            throw new Error("Transport already exists");
        }

        const batchIds = JSON.parse(batchIdsJSON);

        const txMeta = {
            initiatedBy,
            carriedBy,
            txId: ctx.stub.getTxID(),
            timestamp: (() => {
                const t = ctx.stub.getTxTimestamp();
                return new Date(t.seconds.low * 1000 + t.nanos / 1000000).toISOString();
            })()
        };

        const transport = {
            transportId,
            batchIds,
            startTime,
            startLocation: location,
            status: "IN_TRANSIT",
            txMeta,
            trackingLogs: []
        };

        await ctx.stub.putState(transportId, Buffer.from(JSON.stringify(transport)));
        return JSON.stringify(transport);
    }

    async TrackCargo(ctx, transportId, temperature, speed, location, batchIdsJSON, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

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
            batchIds,
            txMeta: {
                initiatedBy,
                carriedBy,
                txId: ctx.stub.getTxID(),
                timestamp
            }
        };

        transport.trackingLogs.push(log);

        await ctx.stub.putState(transportId, Buffer.from(JSON.stringify(transport)));

        return JSON.stringify(log);
    }

    async CompleteTransport(ctx, transportId, endLocation, initiatedBy, carriedBy) {

        assertEmail(initiatedBy, 'initiatedBy');
        assertEmail(carriedBy, 'carriedBy');

        const data = await ctx.stub.getState(transportId);
        if (!data || data.length === 0) {
            throw new Error("Transport not found");
        }

        const transport = JSON.parse(data.toString());

        const txTime = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTime.seconds.low * 1000 + txTime.nanos / 1000000).toISOString();

        transport.status = "DELIVERED";
        transport.endLocation = endLocation;
        transport.endTime = timestamp;
        transport.completionTxMeta = {
            initiatedBy,
            carriedBy,
            txId: ctx.stub.getTxID(),
            timestamp
        };

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

    async GetFullBatchDetails(ctx, batchId) {

        // =========================
        // 1. GET BATCH DATA
        // =========================
        const batchData = await ctx.stub.getState(batchId);

        if (!batchData || batchData.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(batchData.toString());

        // =========================
        // 2. FIND TRANSPORT DATA
        // =========================
        const iterator = await ctx.stub.getStateByRange('', '');

        let transportDetails = [];

        while (true) {
            const res = await iterator.next();

            if (res.value && res.value.value.toString()) {

                const record = JSON.parse(res.value.value.toString());

                // Check if it's a transport object
                if (record.transportId && record.batchIds) {

                    if (record.batchIds.includes(batchId)) {
                        transportDetails.push(record);
                    }
                }
            }

            if (res.done) {
                await iterator.close();
                break;
            }
        }

        // =========================
        // 3. FINAL COMBINED OUTPUT
        // =========================
        const result = {
            batchId: batchId,
            collection: batch.collection,
            drying: batch.drying,
            mixing: batch.mixing,
            product: batch.product,
            transport: transportDetails
        };

        return JSON.stringify(result);
    }
}

module.exports.contracts = [BatchContract];