import "./style.css";
import { setupButton, /* setupSelect */ } from "./dmfinal.js"; //add setupselece

document.querySelector("#app")!.innerHTML = `
  <div>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
  </div>
`;

setupButton(document.querySelector("#counter")!);
//setupSelect(document.querySelector("#select")); //also add this 


