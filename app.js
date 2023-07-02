const getTypeColor = (type) => {
  const normal = "#F5F5F5";
  return (
    {
      normal,
      fire: "#FDDFDF",
      grass: "#DEFDE0",
      electric: "#FCF7DE",
      ice: "#DEF3FD",
      water: "#DEF3FD",
      ground: "#F4E7DA",
      rock: "#D5D5D4",
      fairy: "#FCEAFF",
      poison: "#98D7A5",
      bug: "#F8D5A3",
      ghost: "#CAC0F7",
      dragon: "#97B3E6",
      psychic: "#EAEDA1",
      fighting: "#E6E0D4",
    }[type] || normal
  );
};

const getPokemonsType = async (pokeApiResults) => {
  //obtendo o tipo de cada pokemon
  const promises = pokeApiResults.map((result) => fetch(result.url));

  //esperar todas as promises serem resolvidas em paralelo
  const responses = await Promise.allSettled(promises);

  //filtrar promises apenas com status fulfilled
  const fulfilled = responses.filter(
    (response) => response.status === "fulfilled"
  );

  //extraindo das promises apenas a url de cada pokemon
  const pokePromises = fulfilled.map((url) => url.value.json());
  const pokemons = await Promise.all(pokePromises);

  //fazendo uma array de arrays para poder extrair os tipos
  return pokemons.map((fulfilled) =>
    fulfilled.types.map((info) => DOMPurify.sanitize(info.type.name))
  );
};

const getPokemonsIds = (pokeApiResults) =>
  pokeApiResults.map(({ url }) => {
    //extraindo ids usando split na url para separar cada informação em uma array
    const urlAsArray = DOMPurify.sanitize(url).split("/");
    //como o id é o penúltimo item, usamos .at(urlAsArray.lenght -2) para pegar o tamanho inteiro da array e subtraímos 2 para obter o índice do penúltimo item.
    return urlAsArray.at(urlAsArray.length - 2);
  });

const getPokemonsImgs = async (ids) => {
  //pegando as imagens de cada pokemon da pasta do projeto através de ids
  const promises = ids.map((id) => fetch(`./assets/img/${id}.png`));
  const responses = await Promise.allSettled(promises);
  const fulfilled = responses.filter(
    (response) => response.status === "fulfilled"
  );
  //capturando as urls dessas imagens
  return fulfilled.map((response) => response.value.url);
};

//funcao para nao deixar as variáveis expostas na raiz do projeto (closures)
//IIFE
const paginationInfo = (() => {
  //incrementar offset de 15 em 15 de forma dinâmica
  const limit = 15;
  let offset = 0;

  const getLimit = () => limit;
  const getOffset = () => offset;
  const incrementOffset = () => (offset += limit);

  return { getLimit, getOffset, incrementOffset };
})();

const getPokemons = async () => {
  try {
    const { getLimit, getOffset, incrementOffset } = paginationInfo;
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon?limit=${getLimit()}&offset=${getOffset()}`
    );

    if (!response.ok) {
      throw new Error("nao foi possivel obter informaçoes");
    }

    const { results: pokeApiResults } = await response.json();
    const types = await getPokemonsType(pokeApiResults);
    const ids = getPokemonsIds(pokeApiResults);
    const imgs = await getPokemonsImgs(ids);

    //constrói o array de objetos com as informações para renderizar os pokemons
    //i é uma abreviação de index
    const pokemons = ids.map((id, i) => ({
      id,
      name: pokeApiResults[i].name,
      types: types[i],
      imgUrl: imgs[i],
    }));

    //inrementar o offset
    incrementOffset();

    return pokemons;
  } catch (error) {
    console.log("algo deu errado", error);
  }
};

const renderPokemons = (pokemons) => {
  //selecionamos a ul na qual iremos utilizar para renderizar os pokemons
  const ul = document.querySelector('[data-js="pokemons-list"]');

  //documentFragment é um nó do DOM, um container vazio onde você pode colocar elementos. Ele existe somente em memória, então não é inserido no DOM. Por isso não exige tanto do processamento do dispositivo do usuário, sendo fundamental no ganho de performance quando é necessário renderizar muitos elementos.
  const fragment = document.createDocumentFragment();

  //cada pokemon precisa ser uma li para ser inserido dentro da ul
  pokemons.forEach(({ id, name, types, imgUrl }) => {
    const li = document.createElement("li");

    //cada uma dessas li's precisam ter um nome, um tipo e uma imagem
    const img = document.createElement("img");
    const nameContainer = document.createElement("h2");
    const typeContainer = document.createElement("p");
    const [firstType] = types;

    //setar os atributos necessarios para a img
    img.setAttribute("src", imgUrl);
    img.setAttribute("alt", name);
    img.setAttribute("class", "card-image");

    //setar os atributos necessarios para a li
    li.setAttribute("class", `card ${firstType}`);
    li.style.setProperty("--type-color", getTypeColor(firstType));

    //setar os atributos necessarios para o conteúdo de texto
    nameContainer.textContent = `${id}. ${name[0].toUpperCase()}${name.slice(
      1
    )}`;

    //lógica para caso o pokemon tenha 1 ou 2 tipos
    typeContainer.textContent =
      types.length > 1 ? types.join(" | ") : firstType;

    li.append(img, nameContainer, typeContainer);
    fragment.append(li);
  });
  ul.append(fragment);
};

//função responsável apenas para observar o último elemento da ul que aparecer na tela e assim renderizar os próximos pokemons.
const observeLastPokemon = (pokemonObserver) => {
  //especificar o elemento que queremos observar
  const lastPokemon = document.querySelector(
    '[data-js="pokemons-list"]'
  ).lastChild;
  pokemonObserver.observe(lastPokemon);
};

//função para carregar os próximos 15 pokemons quando a página é scrollada até o fim
const handleNextPokemonsRender = () => {
  //usamos IntersectionObserver quando queremos realizar determinada ação quando um elemento específico aparece na tela, neste caso renderizar mais pokemons quando o último card de pokemon aparecer em nossa tela
  //o que deve acontecer quando o último pokemon estar prestes a ser exibido na tela é inserido como argumento da função IntersectionObserver()
  const pokemonObserver = new IntersectionObserver(
    async ([lastPokemon], observer) => {
      if (!lastPokemon.isIntersecting) {
        return;
      }
      //para que o if nao seja renderizado todas as vezes que chegamos ao fim da página
      observer.unobserve(lastPokemon.target);

      //se o número de pokemons chegar a 150, parar execução
      if (paginationInfo.getOffset() === 150) {
        return;
      }

      const pokemons = await getPokemons();
      renderPokemons(pokemons);
      observeLastPokemon(pokemonObserver);
    },
    { rootMargin: "500px" }
  );
  observeLastPokemon(pokemonObserver);
};

const handlePageLoaded = async () => {
  const pokemons = await getPokemons();
  renderPokemons(pokemons);
  handleNextPokemonsRender();
  console.log(pokemons);
};

handlePageLoaded();
