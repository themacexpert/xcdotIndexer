import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class NetSupply {
    constructor(props?: Partial<NetSupply>) {
        Object.assign(this, props)
    }

    /**
     * Primary key, typically the block number
     */
    @PrimaryColumn_()
    id!: string

    /**
     * Block number when the net supply was calculated
     */
    @Index_()
    @Column_("int4", {nullable: false})
    blockNumber!: number

    /**
     * Net supply of assets after this block
     */
    @Index_()
    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    netSupply!: bigint
}
