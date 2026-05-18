'use strict';

const { Contract } = require('fabric-contract-api');

function assertEmail(email, label) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`${label} must be a valid email address (got: "${email}")`);
    }
}

class BatchContract extends Contract {

    // ========================
    // STEP 1: COLLECTION
    // ========================
    async CreateBatch(ctx, batchId, type, location, dateTime, photo, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const exists = await ctx.stub.getState(batchId);
        if (exists && exists.length > 0) {
            throw new Error("Batch already exists");
        }

        const txMeta = {
            initiatedBy,
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
    async AddDrying(ctx, batchId, temperature, duration, dateTime, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        // Enforce step order: collection must be done first
        if (!batch.collection || !batch.collection.txMeta) {
            throw new Error("Step 1 (Collection) must be completed before adding Drying.");
        }
        // Drying must not already be done
        if (batch.drying && batch.drying.txMeta) {
            throw new Error("Drying has already been recorded for this batch.");
        }

        const txMeta = {
            initiatedBy,
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
    async AddMixing(ctx, batchId, temperature, ingredients, dateTime, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        // Enforce step order: drying must be done first
        if (!batch.drying || !batch.drying.txMeta) {
            throw new Error("Step 2 (Drying) must be completed before adding Mixing.");
        }
        // Mixing must not already be done
        if (batch.mixing && batch.mixing.txMeta) {
            throw new Error("Mixing has already been recorded for this batch.");
        }

        const txMeta = {
            initiatedBy,
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
    async AddProduct(ctx, batchId, photo, dateTime, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) {
            throw new Error("Batch not found");
        }

        const batch = JSON.parse(data.toString());

        // Enforce step order: mixing must be done first
        if (!batch.mixing || !batch.mixing.txMeta) {
            throw new Error("Step 3 (Mixing) must be completed before finalising Product.");
        }
        // Product must not already be done
        if (batch.product && batch.product.txMeta) {
            throw new Error("Product has already been finalised for this batch.");
        }

        const txMeta = {
            initiatedBy,
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
    async CreateTransport(ctx, transportId, batchIdsJSON, startTime, location, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const exists = await ctx.stub.getState(transportId);
        if (exists && exists.length > 0) {
            throw new Error("Transport already exists");
        }

        const batchIds = JSON.parse(batchIdsJSON);

        // Enforce: every batch must have completed all 4 production steps (product ready)
        for (const batchId of batchIds) {
            const batchData = await ctx.stub.getState(batchId);
            if (!batchData || batchData.length === 0) {
                throw new Error(`Batch "${batchId}" not found. Cannot create transport.`);
            }
            const batch = JSON.parse(batchData.toString());
            if (!batch.product || !batch.product.txMeta) {
                throw new Error(`Batch "${batchId}" has not completed all production steps (Product must be finalised). Transport can only begin after Org1 finishes all steps.`);
            }
        }

        const txMeta = {
            initiatedBy,
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

    async TrackCargo(ctx, transportId, temperature, speed, location, batchIdsJSON, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const data = await ctx.stub.getState(transportId);
        if (!data || data.length === 0) {
            throw new Error("Transport not found");
        }

        const transport = JSON.parse(data.toString());

        // Enforce: transport must still be IN_TRANSIT
        if (transport.status !== "IN_TRANSIT") {
            throw new Error(`Transport "${transportId}" is already ${transport.status}. Cannot add tracking logs.`);
        }

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
                txId: ctx.stub.getTxID(),
                timestamp
            }
        };

        transport.trackingLogs.push(log);

        await ctx.stub.putState(transportId, Buffer.from(JSON.stringify(transport)));

        return JSON.stringify(log);
    }

    async CompleteTransport(ctx, transportId, endLocation, initiatedBy) {

        assertEmail(initiatedBy, 'initiatedBy');

        const data = await ctx.stub.getState(transportId);
        if (!data || data.length === 0) {
            throw new Error("Transport not found");
        }

        const transport = JSON.parse(data.toString());

        // Enforce: cannot complete if already delivered
        if (transport.status === "DELIVERED") {
            throw new Error(`Transport "${transportId}" is already marked as DELIVERED.`);
        }

        const txTime = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTime.seconds.low * 1000 + txTime.nanos / 1000000).toISOString();

        transport.status = "DELIVERED";
        transport.endLocation = endLocation;
        transport.endTime = timestamp;
        transport.completionTxMeta = {
            initiatedBy,
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

    // ========================
    // LIST ALL BATCHES
    // ========================
    async GetAllBatches(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const batches = [];

        while (true) {
            const res = await iterator.next();

            if (res.value && res.value.value.toString()) {
                try {
                    const record = JSON.parse(res.value.value.toString());
                    // Only include batch records (not transport records)
                    if (record.batchId && record.collection !== undefined) {
                        batches.push(record);
                    }
                } catch (_) {
                    // skip unparseable records
                }
            }

            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(batches);
    }
}

module.exports.contracts = [BatchContract];