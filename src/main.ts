import {TypeormDatabase, Store} from '@subsquid/typeorm-store'
import {In} from 'typeorm'
import * as ss58 from '@subsquid/ss58'
import assert from 'assert'

import { processor, ProcessorContext, Event, Block, Fields } from './processor';
import {Account, Transfer, IssuedAsset, BurnedAsset, NetSupply} from './model'
import {events} from './types'

processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
   // let transferEvents: TransferEvent[] = getTransferEvents(ctx);

   // let accounts: Map<string, Account> = await createAccounts(ctx, transferEvents);
   // let transfers: Transfer[] = createTransfers(transferEvents, accounts);

    // Process assets.Issued events
    for (const block of ctx.blocks) {
        for (const event of block.events) {
            console.log('The name of this event is ' + event.name);
            if (event.name === 'Assets.Issued') {
                await handleAssetsIssued(ctx, block, event);
            }
            else if (event.name === 'Assets.Burned') {
                await handleAssetsBurned(ctx, block, event);
            }
        }
    }

    // await ctx.store.upsert([...accounts.values()]);
    // await ctx.store.insert(transfers);
});

// Utility function to normalize event args
function normalizeEventArgs(args: any) {
  return {
    assetId: args.asset_id || args.AssetId || args.assetId,
    owner: args.owner || args.AccountId,
    amount: args.amount || args.Balance || args.balance || args.totalSupply ,
  };
}


async function handleAssetsIssued(ctx: any, block: any, event: any) {
    const issuedAsset = new IssuedAsset();
    console.log(block);
    console.log(`Handling Assets.Issued event at block ${block.header.height}`);
    issuedAsset.id = `${block.header.height}-${event.index}`;
    issuedAsset.blockNumber = block.header.height;

    if (block.header.timestamp !== undefined) {
        issuedAsset.timestamp = new Date(block.header.timestamp);
    } else {
        console.error(`Timestamp is undefined for block at height ${block.header.height}`);
        return;
    }

    console.log(event.args);

    const { assetId, owner, amount } = normalizeEventArgs(event.args);

    if (assetId.toString() === '42259045809535163221576417993425387648') {
        let account = await ctx.store.get(Account, { where: { id: owner } });
        if (!account) {
            account = new Account();
            account.id = owner;
            await ctx.store.save(account);
        }

        issuedAsset.owner = account;
        issuedAsset.amount = amount;

        await ctx.store.save(issuedAsset);

        // Decide on how to handle the amount for net supply updates
        //const theAmount = amount !== undefined ? amount : event.args.totalSupply; // Adjust this line if totalSupply is also variably named.
        if (amount !== undefined) {
          await updateNetSupply(ctx, block.header.height, BigInt(amount), 'issue');
        } else {
          console.error(`Amount is undefined for event at block ${block.header.height}`);
        }
    }
}



async function handleAssetsBurned(ctx: ProcessorContext<Store>, block: any, event: Event): Promise<void> {
    // Create a new instance of BurnedAsset
    const burnedAsset = new BurnedAsset();
    console.log(`Handling Assets.Burned event at block ${block.header.height}`);
    burnedAsset.id = `${block.header.height}-${event.index}`;
    burnedAsset.blockNumber = block.header.height;

    // Set the timestamp on the instance only if it's available
    if (block.header.timestamp !== undefined) {
        burnedAsset.timestamp = new Date(block.header.timestamp);
    } else {
        console.error(`Timestamp is undefined for block at height ${block.header.height}`);
        return;
    }

    console.log(event.args);

    // Destructure the event args to get the assetId, owner, and balance
    //const { assetId, owner, balance } = event.args;
    const { assetId, owner, amount } = normalizeEventArgs(event.args);

    // Check if the assetId matches the one you're interested in
    if (assetId.toString() === '42259045809535163221576417993425387648') {
        // Ensure the account entity for the owner exists
        let account = await ctx.store.get(Account, { where: { id: owner } });
        if (!account) {
            account = new Account();
            account.id = owner; // Use owner instead of burner
            await ctx.store.save(account);
        }

        // Assign the account to the owner property of burnedAsset
        burnedAsset.owner = account;
        // Assign the balance to the balance property of burnedAsset
        burnedAsset.balance = amount; // Convert string to BigInt

        // Save the new BurnedAsset instance
        await ctx.store.save(burnedAsset);

        if (amount !== undefined) {
           await updateNetSupply(ctx, block.header.height, -BigInt(amount), 'burn');
        } else {
          console.error(`Amount is undefined for event at block ${block.header.height}`);
        }
    }
}

async function updateNetSupply(ctx: ProcessorContext<Store>, blockNumber: number, value: bigint, type: 'issue' | 'burn'): Promise<void> {
  // Get the last NetSupply entry
  let lastNetSupplyEntries = await ctx.store.find(NetSupply, { 
    order: { blockNumber: 'DESC' },
    take: 1
  });

  let lastNetSupply = lastNetSupplyEntries.length > 0 ? lastNetSupplyEntries[0] : null;
  let netSupplyValue = BigInt(0); // Default value if lastNetSupply does not exist

  // If there was a previous entry, use its netSupply value
  if (lastNetSupply) {
    netSupplyValue = BigInt(lastNetSupply.netSupply);
  }

  // Adjust the net supply based on whether assets were issued or burned
  if (type === 'issue') {
    netSupplyValue += BigInt(value); // value is already a bigint, no need to convert
  } else if (type === 'burn') {
    netSupplyValue -= BigInt(value); // value is already a bigint, no need to convert
  }

  // Create a new NetSupply entry or update the existing one
  const newNetSupply = new NetSupply();
  newNetSupply.id = blockNumber.toString(); // Set id to the block number if it's unique
  newNetSupply.blockNumber = blockNumber;
  newNetSupply.netSupply = netSupplyValue; // Updated net supply value

  // Save the new NetSupply entry
  await ctx.store.save(newNetSupply);
}


interface TransferEvent {
    id: string
    blockNumber: number
    timestamp: Date
    extrinsicHash?: string
    from: string
    to: string
    amount: bigint
    fee?: bigint
}

// function getTransferEvents(ctx: ProcessorContext<Store>): TransferEvent[] {
//     // Filters and decodes the arriving events
//     let transfers: TransferEvent[] = []
//     for (let block of ctx.blocks) {
//         for (let event of block.events) {
//             if (event.name == events.balances.transfer.name) {
//                 let rec: {from: string; to: string; amount: bigint}
//                 if (events.balances.transfer.v1020.is(event)) {
//                     let [from, to, amount] = events.balances.transfer.v1020.decode(event)
//                     rec = {from, to, amount}
//                 }
//                 else if (events.balances.transfer.v1050.is(event)) {
//                     let [from, to, amount] = events.balances.transfer.v1050.decode(event)
//                     rec = {from, to, amount}
//                 }
//                 else if (events.balances.transfer.v9130.is(event)) {
//                     rec = events.balances.transfer.v9130.decode(event)
//                 }
//                 else {
//                     throw new Error('Unsupported spec')
//                 }

//                 assert(block.header.timestamp, `Got an undefined timestamp at block ${block.header.height}`)

//                 transfers.push({
//                     id: event.id,
//                     blockNumber: block.header.height,
//                     timestamp: new Date(block.header.timestamp),
//                     extrinsicHash: event.extrinsic?.hash,
//                     from: rec.from,
//                     to: rec.to,
//                     amount: rec.amount,
//                     fee: event.extrinsic?.fee || 0n,
//                 })
//             }
//         }
//     }
//     return transfers
// }

async function createAccounts(ctx: ProcessorContext<Store>, transferEvents: TransferEvent[]): Promise<Map<string,Account>> {
    const accountIds = new Set<string>()
    for (let t of transferEvents) {
        accountIds.add(t.from)
        accountIds.add(t.to)
    }

    const accounts = await ctx.store.findBy(Account, {id: In([...accountIds])}).then((accounts) => {
        return new Map(accounts.map((a) => [a.id, a]))
    })

    for (let t of transferEvents) {
        updateAccounts(t.from)
        updateAccounts(t.to)
    }

    function updateAccounts(id: string): void {
        const acc = accounts.get(id)
        if (acc == null) {
            accounts.set(id, new Account({id}))
        }
    }

    return accounts
}

// function createTransfers(transferEvents: TransferEvent[], accounts: Map<string, Account>): Transfer[] {
//     let transfers: Transfer[] = []
//     for (let t of transferEvents) {
//         let {id, blockNumber, timestamp, extrinsicHash, amount, fee} = t
//         let from = accounts.get(t.from)
//         let to = accounts.get(t.to)
//         transfers.push(new Transfer({
//             id,
//             blockNumber,
//             timestamp,
//             extrinsicHash,
//             from,
//             to,
//             amount,
//             fee,
//         }))
//     }
//     return transfers
// }
