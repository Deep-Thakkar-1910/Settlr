export type Settlr = {
  address: "DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC";
  metadata: {
    name: "settlr";
    version: "0.1.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "create_invoice";
      discriminator: [154, 170, 31, 135, 134, 100, 156, 146];
      accounts: [
        { name: "invoice"; writable: true; pda: { seeds: [{ kind: "const"; value: [105, 110, 118, 111, 105, 99, 101] }, { kind: "account"; path: "freelancer" }, { kind: "arg"; path: "invoice_id" }] } },
        { name: "freelancer"; writable: true; signer: true },
        { name: "system_program"; address: "11111111111111111111111111111111" }
      ];
      args: [
        { name: "invoice_id"; type: "u64" },
        { name: "amount"; type: "u64" },
        { name: "description"; type: "string" },
        { name: "deadline"; type: "i64" },
        { name: "client"; type: "pubkey" }
      ];
    },
    {
      name: "pay_invoice";
      discriminator: [104, 6, 62, 239, 197, 206, 208, 220];
      accounts: [
        { name: "invoice"; writable: true },
        { name: "client"; signer: true; relations: ["invoice"] }
      ];
      args: [];
    }
  ];
  accounts: [{ name: "Invoice"; discriminator: [51, 194, 250, 114, 6, 104, 18, 164] }];
  errors: [
    { code: 6000; name: "DescriptionTooLong"; msg: "Description too long" },
    { code: 6001; name: "InvalidDeadline"; msg: "Deadline must be in the future" },
    { code: 6002; name: "AlreadyPaid"; msg: "Invoice already paid" },
    { code: 6003; name: "Unauthorized"; msg: "Only the client can pay this invoice" },
    { code: 6004; name: "InvoiceExpired"; msg: "Invoice has expired" },
    { code: 6005; name: "InvalidAmount"; msg: "Amount must be greater than zero" }
  ];
  types: [
    {
      name: "Invoice";
      type: {
        kind: "struct";
        fields: [
          { name: "freelancer"; type: "pubkey" },
          { name: "client"; type: "pubkey" },
          { name: "amount"; type: "u64" },
          { name: "description"; type: "string" },
          { name: "deadline"; type: "i64" },
          { name: "status"; type: { defined: { name: "InvoiceStatus" } } },
          { name: "created_at"; type: "i64" },
          { name: "bump"; type: "u8" }
        ];
      };
    },
    {
      name: "InvoiceStatus";
      type: { kind: "enum"; variants: [{ name: "Pending" }, { name: "Paid" }] };
    }
  ];
};

export const IDL: Settlr = {
  address: "DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC",
  metadata: { name: "settlr", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "create_invoice",
      discriminator: [154, 170, 31, 135, 134, 100, 156, 146],
      accounts: [
        { name: "invoice", writable: true, pda: { seeds: [{ kind: "const", value: [105, 110, 118, 111, 105, 99, 101] }, { kind: "account", path: "freelancer" }, { kind: "arg", path: "invoice_id" }] } },
        { name: "freelancer", writable: true, signer: true },
        { name: "system_program", address: "11111111111111111111111111111111" }
      ],
      args: [
        { name: "invoice_id", type: "u64" },
        { name: "amount", type: "u64" },
        { name: "description", type: "string" },
        { name: "deadline", type: "i64" },
        { name: "client", type: "pubkey" }
      ],
    },
    {
      name: "pay_invoice",
      discriminator: [104, 6, 62, 239, 197, 206, 208, 220],
      accounts: [
        { name: "invoice", writable: true },
        { name: "client", signer: true, relations: ["invoice"] }
      ],
      args: [],
    }
  ],
  accounts: [{ name: "Invoice", discriminator: [51, 194, 250, 114, 6, 104, 18, 164] }],
  errors: [
    { code: 6000, name: "DescriptionTooLong", msg: "Description too long" },
    { code: 6001, name: "InvalidDeadline", msg: "Deadline must be in the future" },
    { code: 6002, name: "AlreadyPaid", msg: "Invoice already paid" },
    { code: 6003, name: "Unauthorized", msg: "Only the client can pay this invoice" },
    { code: 6004, name: "InvoiceExpired", msg: "Invoice has expired" },
    { code: 6005, name: "InvalidAmount", msg: "Amount must be greater than zero" }
  ],
  types: [
    {
      name: "Invoice",
      type: {
        kind: "struct",
        fields: [
          { name: "freelancer", type: "pubkey" },
          { name: "client", type: "pubkey" },
          { name: "amount", type: "u64" },
          { name: "description", type: "string" },
          { name: "deadline", type: "i64" },
          { name: "status", type: { defined: { name: "InvoiceStatus" } } },
          { name: "created_at", type: "i64" },
          { name: "bump", type: "u8" }
        ],
      },
    },
    {
      name: "InvoiceStatus",
      type: { kind: "enum", variants: [{ name: "Pending" }, { name: "Paid" }] },
    }
  ],
} as unknown as Settlr;
