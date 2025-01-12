// import dns from 'dns';

// dns.resolveMx('rapidmock.com', (err, addresses) => {
//   if (err) {
//     console.error('No MX records found');
//   } else {
//     console.log('MX Records:', addresses);
//   }
// });

import { SMTPClient } from 'smtp-client';

async function verifyEmail(email) {
  const domain = email.split('@')[1];
  const client = new SMTPClient({
    host: 'aspmx.l.google.com', // Replace with the domain's MX record host
    port: 25,
  });

  try {
    await client.connect();
    await client.greet({ hostname: 'rapidmock.com' });
    await client.mail({ from: 'support@rapidmock.com' });
    await client.rcpt({ to: email });
    console.log('Email exists');
  } catch (err) {
    console.error('Email does not exist:');
  } finally {
    await client.quit();
  }
}
(async() => {
    await verifyEmail('joenebua123@gmail.com');
})();
