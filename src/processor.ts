import { assertNotNull } from '@subsquid/util-internal';
import { lookupArchive } from '@subsquid/archive-registry';
import {
    BlockHeader,
    DataHandlerContext,
    SubstrateBatchProcessor,
    SubstrateBatchProcessorFields,
    Event as _Event,
    Call as _Call,
    Extrinsic as _Extrinsic
} from '@subsquid/substrate-processor';

import { events } from './types';

export const processor = new SubstrateBatchProcessor()
    .setDataSource({
        archive: (lookupArchive('moonbeam', { type: 'Substrate', release: 'ArrowSquid' })),
        chain: {
            url: assertNotNull(process.env.RPC_ENDPOINT),
            rateLimit: 10
        }
    })
    .addEvent({
        name: ['Assets.Issued', 'Assets.Burned'], // Include 'assets.Issued' event
        extrinsic: true
    })
    .setFields({
        event: {
            args: true
        },
        extrinsic: {
            hash: true,
            fee: true
        },
        block: {
            timestamp: true
        }
    })
    .setBlockRange({
        from: 800000,
    })
    // .useArchiveOnly()

export type Fields = SubstrateBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Event = _Event<Fields>;
export type Call = _Call<Fields>;
export type Extrinsic = _Extrinsic<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
