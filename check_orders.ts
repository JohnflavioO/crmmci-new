
const LOJA_INTEGRADA_API = 'https://api.awsli.com.br/v1';
const apiKey = '12ac635b711ce3b105bc';
const applicationKey = 'ecdca8a5-487f-46f0-a61d-27eab2cc98f6';

async function fetchOrders() {
  const url = `${LOJA_INTEGRADA_API}/pedido?limit=10&offset=0&ordering=data_criacao`;
  console.log(`Calling: GET ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`API error: ${response.status} ${text}`);
    return;
  }

  const data = await response.json();
  console.log('Latest orders from Loja Integrada:');
  data.objects.forEach(order => {
    console.log(`Order #${order.numero} - Date: ${order.data_criacao} - Status: ${order.situacao?.nome || order.situacao} - Total: ${order.valor_total}`);
  });
}

fetchOrders();
