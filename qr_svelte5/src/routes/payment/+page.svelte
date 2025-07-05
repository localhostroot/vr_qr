<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';

  const paykeeperUrl = "https://4-neba.server.paykeeper.ru/create/";

  onMount(() => {
    // Get payment data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const totalAmount = urlParams.get('amount');
    const userId = urlParams.get('user_id');

    if (!orderId || !totalAmount || !userId) {
      console.error('Missing payment parameters');
      document.body.innerHTML = '<p style="text-align: center; margin-top: 20vh; color: red;">Ошибка: отсутствуют данные для оплаты</p>';
      return;
    }

    // Create and submit the payment form
    const form = document.createElement('form');
    form.action = paykeeperUrl;
    form.method = 'POST';
    form.target = '_self';
    form.style.display = 'none';

    const addInput = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    // Add form fields
    addInput('sum', totalAmount);
    addInput('clientid', userId);
    addInput('orderid', orderId);
    addInput('name', "Оплата за просмотр фильмов");
    addInput('success_url', `${window.location.origin}${getSubfolder()}/payment-result?success=true`);
    addInput('fail_url', `${window.location.origin}${getSubfolder()}/payment-result?success=false`);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  });
</script>

<template>
  <p>Redirecting to the payment page...</p>
</template>

<style>
  p {
    text-align: center;
    margin-top: 20vh;
    font-size: 1.2em;
    font-family: 'Montserrat', sans-serif;
  }
</style>
