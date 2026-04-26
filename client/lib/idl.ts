/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/settlr.json`.
 */
export type Settlr = {
  "address": "DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC",
  "metadata": {
    "name": "settlr",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createInvoice",
      "discriminator": [
        154,
        170,
        31,
        135,
        134,
        100,
        156,
        146
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  111,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "freelancer"
              },
              {
                "kind": "arg",
                "path": "invoiceId"
              }
            ]
          }
        },
        {
          "name": "freelancer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "invoiceId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "client",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "payInvoice",
      "discriminator": [
        104,
        6,
        62,
        239,
        197,
        206,
        208,
        220
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true
        },
        {
          "name": "client",
          "signer": true,
          "relations": [
            "invoice"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "registerUsername",
      "discriminator": [
        134,
        54,
        123,
        181,
        28,
        151,
        36,
        0
      ],
      "accounts": [
        {
          "name": "username",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  110,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "invoice",
      "discriminator": [
        51,
        194,
        250,
        114,
        6,
        104,
        18,
        164
      ]
    },
    {
      "name": "username",
      "discriminator": [
        149,
        84,
        41,
        80,
        177,
        203,
        232,
        168
      ]
    }
  ],
  "events": [
    {
      "name": "invoiceCreated",
      "discriminator": [
        189,
        114,
        235,
        219,
        193,
        125,
        47,
        54
      ]
    },
    {
      "name": "invoicePaid",
      "discriminator": [
        200,
        211,
        168,
        170,
        46,
        82,
        83,
        186
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "descriptionTooLong",
      "msg": "Description too long"
    },
    {
      "code": 6001,
      "name": "invalidDeadline",
      "msg": "Deadline must be in the future"
    },
    {
      "code": 6002,
      "name": "alreadyPaid",
      "msg": "Invoice already paid"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Only the client can pay this invoice"
    },
    {
      "code": 6004,
      "name": "invoiceExpired",
      "msg": "Invoice has expired"
    },
    {
      "code": 6005,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6006,
      "name": "invalidUsernameLength",
      "msg": "Username must be 3-32 characters"
    },
    {
      "code": 6007,
      "name": "invalidUsernameChars",
      "msg": "Username may only contain lowercase letters, digits, and underscores"
    }
  ],
  "types": [
    {
      "name": "invoice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "freelancer",
            "type": "pubkey"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "invoiceStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "invoiceCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "invoicePda",
            "type": "pubkey"
          },
          {
            "name": "freelancer",
            "type": "pubkey"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "invoicePaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "invoicePda",
            "type": "pubkey"
          },
          {
            "name": "paidAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "invoiceStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "paid"
          }
        ]
      }
    },
    {
      "name": "username",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
