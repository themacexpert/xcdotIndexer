import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, ManyToOne as ManyToOne_} from "typeorm"
import * as marshal from "./marshal"
import {Account} from "./account.model"

@Entity_()
export class BurnedAsset {
    constructor(props?: Partial<BurnedAsset>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    /**
     * Block number when the asset was burned
     */
    @Index_()
    @Column_("int4", {nullable: false})
    blockNumber!: number

    /**
     * Timestamp when the asset was burned
     */
    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date

    /**
     * The account from which the asset was burned
     */
    @Index_()
    @ManyToOne_(() => Account, {nullable: true})
    owner!: Account

    /**
     * Balance of the asset after it was burned
     */
    @Index_()
    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    balance!: bigint
}
