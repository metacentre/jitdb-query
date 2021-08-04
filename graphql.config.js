module.exports = {
  projects: {
    app: {
      schema: ['/home/av8ta/.ssb-db2/graphql/schema.graphql'],
      // schema: ['src/schema.graphql', 'directives.graphql'],
      documents: ['**/*.{graphql,js,ts,jsx,tsx}'],
      // documents: ['**/*.{graphql,js,ts,jsx,tsx}', 'my/fragments.graphql'],
      extensions: {
        endpoints: {
          default: {
            url: 'http://localhost:2002/graphql'
            // headers: { Authorization: `Bearer ${process.env.API_TOKEN}` }
          }
        }
      }
    }
    // db: {
    //   schema: 'src/generated/db.graphql',
    //   documents: ['src/db/**/*.graphql', 'my/fragments.graphql'],
    //   extensions: {
    //     codegen: [
    //       {
    //         generator: 'graphql-binding',
    //         language: 'typescript',
    //         output: {
    //           binding: 'src/generated/db.ts'
    //         }
    //       }
    //     ],
    //     endpoints: {
    //       default: {
    //         url: 'http://localhost:8080',
    //         headers: { Authorization: `Bearer ${process.env.API_TOKEN}` }
    //       }
    //     }
    //   }
    // }
  }
}
