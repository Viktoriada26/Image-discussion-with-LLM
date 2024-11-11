import { AnyActorRef, assign, createActor, fromPromise, setup } from "xstate";
import { speechstate, SpeechStateExternalEvent } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings = {
  azureRegion: "northeurope",
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

/* Grammar definition */
interface Grammar {
  [index: string]: { person?: string; day?: string; time?: string };
}
const grammar: Grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};




const dearClient = ["Please try to continue the discussion", "If you feel that is a difficult topic we can continue with another image"];
function randomRepeat(myarray: any) {
    const randomIndex = Math.floor(Math.random() * myarray.length);
    return myarray[randomIndex];
}

interface MyDMContext extends DMContext {
  noinputCounter: number;
  availableModels?: string[];

}
interface DMContext {
  count: number;
  ssRef: AnyActorRef;
  messages: Message[];
  prompt? : string ;
  selectedcategory: string,
  selectedimage : string;

}

interface Message {
  role: "assistant" | "user" | "system";
  content: string;
  
  //selectedimage : string;

}
const dmMachine = setup({
  types: {} as {
    context: MyDMContext;
    events: SpeechStateExternalEvent | { type: "CLICK" } | {type: "ClickImage1"} | {type: "ClickImage2"} | {type: "ClickImage3"} | {type: "ClickImage4"} | {type: "ClickCartoons"} | {type: "ClickPaintings"} ;
  },
  guards: {
    noinputCounterMoreThanOne: ({ context }) => {
      if (context.noinputCounter > 1) {
        return true;
      } else {
        return false;
      }
    },
  },
  actions: {
    /* define your actions here */
    speechstate_prepare: ({ context }) =>
      context.ssRef.send({ type: "PREPARE" }),
    speechstate_listen: ({ context }) => context.ssRef.send({ type: "LISTEN" }),
    speechstate_speak: ({ context }, params: { value: string }) =>
      context.ssRef.send({ type: "SPEAK", value: { utterance: params.value } }),
    debug: (event) => console.debug(event),
    assign_noinputCounter: assign(({ context }, params?: { value: number }) => {
      if (!params) {
        return { noinputCounter: context.noinputCounter + 1 };
      }
      return { noinputCounter: context.noinputCounter + params.value };
    }),
  },
  actors: {
    get_ollama_models: fromPromise<any, null>(async () => {
      return fetch("http://localhost:11434/api/tags").then((response) =>
        response.json()
      );
    }),    
  LMactor : fromPromise<any,{prompt:Message[]}>(async ({input}) => {
      const body = {
        model: "gemma2", //"llama3.1",
        stream: false,
        messages : input.prompt,
        temperature : 0.8
      };
      return fetch("http://localhost:11434/api/chat", {
        method: "POST",
        body: JSON.stringify(body),
      }).then((response) => response.json());
    }),
  },
}).createMachine({
  context: ({ spawn }) => ({
    count: 0,
    ssRef: spawn(speechstate, { input: settings }),
    messages: [], //add in prompt
    noinputCounter: 0,
    selectedimage: "",
    selectedcategory: "",
    // moreStuff: {thingOne: 1, thingTwo: 2}
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: [{ type: "speechstate_prepare" }],
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: {
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "GetModels",
      states: {
        GetModels: {
          invoke: {
            src: "get_ollama_models",
            input: null,
            onDone: {
              target: "Prompt", 
              actions: assign(({ event }) => {
                console.log(event.output);
                return {
                  availableModels: event.output.models.map((m: any) => m.name),
                };
              }),
            },
            onError: {
              actions: () => console.error("no models available"),
            },
          },
        },
        Prompt: {
          invoke: {
            src: "LMactor",
            input: ({}) => ({prompt: [{role: "user", content: "Hello"}] }),
            onDone: {
              target: "AskImage", 
              actions: [({event}) => console.log(event.output.message.content),
                assign(({context, event}) =>{
                return {
                  messages: [...context.messages,{
                    role: "assistant",
                    content : event.output.message.content,
                  },
                ],
              };
            }),
          ],
        },
      },
    },


    AskImage: {
      entry: [
        { 
          type: "speechstate_speak", 
          params: { value: "Please choose the level that suits you better: A2 or B1." } 
        },
        () => {
          document.getElementById("categoryPage")!.style.display = "block";
          document.getElementById("cartoonOptions")!.style.display = "none";
          document.getElementById("paintingOptions")!.style.display = "none";
        }
      ],
      
      on: {
        ClickCartoons: {
          target: "CartoonOptions",
          actions: [
            assign(() => ({ selectedcategory: "CartoonOptions" })),
            () => {
              document.getElementById("categoryPage")!.style.display = "none";
              document.getElementById("cartoonOptions")!.style.display = "block";
            }
          ],
        },
        ClickPaintings: {
          target: "PaintingOptions",
          actions: [assign(() => ({ selectedcategory: "PaintingOptions" })),
          () => {
            document.getElementById("categoryPage")!.style.display = "none";
            document.getElementById("paintingOptions")!.style.display = "block";
            document.getElementById("cartoonOptions")!.style.display = "none"; 
          },

        ],
        },
      }

      },









    CartoonOptions: {
      entry: {
        type: "speechstate_speak",
        params: { value: "You chose Level A2.Here you can find some cartoons images. Please select an image." }
      },
      on: {
        ClickImage1: {
          target: "DiscussImageOne",
          actions: assign(() => ({ selectedimage: "Scoobydoo" })),
        },
        ClickImage2: {
          target: "DiscussImageTwo",
          actions: assign(() => ({ selectedimage: "Mickeymouse" })),
        },
      },
    },
    PaintingOptions: {
      entry: {
        type: "speechstate_speak",
        params: { value: "You chose Level B1. Here you can find some Paintings. Please select an image." }
      },
      on: {
        ClickImage3: {
          target: "DiscussImageThree",
          actions: assign(() => ({ selectedimage: "Paris" })),
        },
        ClickImage4: {
          target: "DiscussImageFour",
          actions: assign(() => ({ selectedimage: "Lasmeninas" })),
        },
      },
    },






DiscussImageOne:{entry: {
  type: 'speechstate_speak',
  params: { value: 'You selected Scooby-Doo! Scooby-Doo is a famous animated dog character known for solving mysteries with his friends. What would you like to discuss about Scooby-Doo?' },
},
on: {
  SPEAK_COMPLETE: "ListenImageOne",
},},

DiscussImageTwo: {entry: {
  type: 'speechstate_speak',
  params: { value: 'You selected Mickey Mouse! Mickey is an iconic cartoon character created by Walt Disney, known worldwide. What would you like to talk about Mickey Mouse?' },
},
on: {
  SPEAK_COMPLETE: "ListenImageTwo",
},},



DiscussImageThree: {entry: {
  type: 'speechstate_speak',
  params: { value: 'You selected Paris! What would you like to discuss about Paris?' },
},
on: {
  SPEAK_COMPLETE: "ListenImageThree",
},},

DiscussImageFour: {entry: {
  type: 'speechstate_speak',
  params: { value: 'You selected Las Meninas!  What would you like to discuss about Las Meninas?' },
},
on: {
  SPEAK_COMPLETE: "ListenImageFour",
},
},



ListenImageOne: {entry: {
  type: "speechstate_listen"},

on: {
  ASR_NOINPUT: 
  [{
      guard: ({ context }) => context.noinputCounter <= 1,
      target: "Canthear1",
      actions: ({ context }) => context.noinputCounter++
  },
  {
      guard: ({ context }) => context.noinputCounter > 3,
      target: "#DM.Done"
  }],

  RECOGNISED: [
    {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("change the level") || event.value[0].utterance.toLowerCase().includes("talk about something else"),
    target: "AskImage",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  },


  {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("finish this conversation") || event.value[0].utterance.toLowerCase().includes("finish this discussion"),
    target: "Enddiscussion1",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  },

  

  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "CartoonOptions",
    target: "CartoonOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },
  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "PaintingOptions",
    target: "PaintingOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },

  {
    target: "thediscImageone",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  }
],
},
},

Canthear1: {
  entry: {
    type: "speechstate_speak",
    params : {value:  randomRepeat(dearClient)},
  }, 
  on: {
      SPEAK_COMPLETE: "ListenImageOne",
  },
},


Enddiscussion1: {entry: {
  type: 'speechstate_speak',
  params: { value: 'Okay, I wish you success with your results. ' },
},
on: {
  SPEAK_COMPLETE: "#DM.Done",
}},





ListenImageTwo: {entry: {
  type: "speechstate_listen"
},
on: {
  ASR_NOINPUT: 
              [{
                  guard: ({ context }) => context.noinputCounter <= 1,
                  target: "Canthear2",
                  actions: ({ context }) => context.noinputCounter++
              },
              {
                  guard: ({ context }) => context.noinputCounter > 3,
                  target: "#DM.Done"
              }],
  RECOGNISED: [
    {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("change the level") || event.value[0].utterance.toLowerCase().includes("talk about something else"),
    target: "AskImage",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  },

  {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("finish this conversation") || event.value[0].utterance.toLowerCase().includes("finish this discussion"),
  target: "Enddiscussion2",
  actions: assign(({ context, event }) => { 
    return { 
      messages: [ 
        ...context.messages, 
        { role: "user", content: event.value[0].utterance }
      ]
    };
  })
},

  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "CartoonOptions",
    target: "CartoonOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },
  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "PaintingOptions",
    target: "PaintingOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },



  {
    target: "thediscImagetwo",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  }
],}},


Canthear2: {
  entry: {
    type: "speechstate_speak",
    params : {value:  randomRepeat(dearClient)},
  }, 
  on: {
      SPEAK_COMPLETE: "ListenImageTwo",
  },
},


Enddiscussion2: {entry: {
  type: 'speechstate_speak',
  params: { value: 'Okay, I wish you success with your results. ' },
},
on: {
  SPEAK_COMPLETE: "#DM.Done",
}},



ListenImageThree: {entry: {
  type: "speechstate_listen"
},
on: {
  ASR_NOINPUT: 
  [{
      guard: ({ context }) => context.noinputCounter <= 1,
      target: "Canthear3",
      actions: ({ context }) => context.noinputCounter++
  },
  {
      guard: ({ context }) => context.noinputCounter > 3,
      target: "#DM.Done"
  }],


  RECOGNISED: [
    {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("change the level")|| event.value[0].utterance.toLowerCase().includes("talk about something else"),
    target: "AskImage",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  },

  {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("finish this conversation") || event.value[0].utterance.toLowerCase().includes("finish this discussion"),
  target: "Enddiscussion3",
  actions: assign(({ context, event }) => { 
    return { 
      messages: [ 
        ...context.messages, 
        { role: "user", content: event.value[0].utterance }
      ]
    };
  })
},

  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "CartoonOptions",
    target: "CartoonOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },
  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "PaintingOptions",
    target: "PaintingOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },

  {
    target: "thediscImagethree",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  }
],}},


Canthear3: {
  entry: {
    type: "speechstate_speak",
    params : {value:  randomRepeat(dearClient)},
  }, 
  on: {
      SPEAK_COMPLETE: "ListenImageThree",
  },
},

Enddiscussion3: {entry: {
  type: 'speechstate_speak',
  params: { value: 'Okay, I wish you success with your results. ' },
},
on: {
  SPEAK_COMPLETE: "#DM.Done",
}},



ListenImageFour: {entry: {
  type: "speechstate_listen"
},
on: {
  ASR_NOINPUT: 
  [{
      guard: ({ context }) => context.noinputCounter <= 1,
      target: "Canthear4",
      actions: ({ context }) => context.noinputCounter++
  },
  {
      guard: ({ context }) => context.noinputCounter > 3,
      target: "#DM.Done"
  }],

  RECOGNISED: [
    {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("change the level")|| event.value[0].utterance.toLowerCase().includes("talk about something else"),
    target: "AskImage",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  },

  {guard: ({event}) =>  event.value[0].utterance.toLowerCase().includes("finish this conversation") || event.value[0].utterance.toLowerCase().includes("finish this discussion"),
  target: "Enddiscussion4",
  actions: assign(({ context, event }) => { 
    return { 
      messages: [ 
        ...context.messages, 
        { role: "user", content: event.value[0].utterance }
      ]
    };
  })
},

  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "CartoonOptions",
    target: "CartoonOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },
  {
    guard: ({ context, event }) =>
      event.value[0].utterance.toLowerCase().includes("change the image") &&
      context.selectedcategory === "PaintingOptions",
    target: "PaintingOptions", 
    actions: assign(({ context, event }) => {
      return {
        messages: [
          ...context.messages,
          { role: "user", content: event.value[0].utterance }
        ]
      };
    }),
  },


  {
    target: "thediscImagefour",
    actions: assign(({ context, event }) => { 
      return { 
        messages: [ 
          ...context.messages, 
          { role: "user", content: event.value[0].utterance }
        ]
      };
    })
  }
],}},


Canthear4: {
  entry: {
    type: "speechstate_speak",
    params : {value:  randomRepeat(dearClient)},
  }, 
  on: {
      SPEAK_COMPLETE: "ListenImageFour",
  },
},

Enddiscussion4: {entry: {
  type: 'speechstate_speak',
  params: { value: 'Okay, I wish you success with your results. ' },
},
on: {
  SPEAK_COMPLETE: "#DM.Done",
}},


  AnswerImageOne: {
    entry: {
      type: "speechstate_speak",
      params: ({ context }) => {
        const utterance = context.messages[context.messages.length - 1]; 
        return { value: utterance.content  };
      },   
    },
    on: { SPEAK_COMPLETE: "ListenImageOne"},
},


  AnswerImageTwo: {
    entry: {
      type: "speechstate_speak",
      params: ({ context }) => {
        const utterance = context.messages[context.messages.length - 1]; 
        return { value: utterance.content  };
      },   
    },
    on: { SPEAK_COMPLETE: "ListenImageTwo"},
},

AnswerImageThree: {
  entry: {
    type: "speechstate_speak",
    params: ({ context }) => {
      const utterance = context.messages[context.messages.length - 1]; 
      return { value: utterance.content  };
    },   
  },
  on: { SPEAK_COMPLETE: "ListenImageThree"},
},

  AnswerImageFour: {
    entry: {
      type: "speechstate_speak",
      params: ({ context }) => {
        const utterance = context.messages[context.messages.length - 1]; 
        return { value: utterance.content  };
      },   
    },
    on: { SPEAK_COMPLETE: "ListenImageFour"},
},


thediscImageone: {invoke: {
  src: "LMactor",
  input: ({context}) => ({prompt: [{role: "user", 
    content: 
`  DESCRIPTION OF THE IMAGE: The image shows all the 5 main characters from Scooby-Doo:
On your left is Velma Dinkley. Velma is wearing her signature orange turtleneck sweater, paired with a red pleated skirt. She also has knee-high orange socks and red shoes.
Pose: She looks somewhat startled, with her right hand extended in front of her, and her left arm bent slightly. Her body is slightly turned to her left, and her head is tilted in the same direction, as if reacting to something surprising.
Next to Velma, on her right side is Shaggy Rogers. Shaggy is wearing his typical outfit—a baggy light-green T-shirt and brown pants, with black shoes.
He appears scared or cautious. His body is slightly hunched over, and he has his left arm bent towards his face, while his right arm is extended to the side. He is looking forward with a worried expression, as if anticipating something frightening.
In the center on the right next to Shaggy and on the left next to Fred is Scooby-Doo. Scooby, the Great Dane, is brown with black spots and is wearing his trademark blue collar with an SD (Scooby-Doo) tag.
Scooby is standing on all fours, positioned in the center of the group. His expression is nervous or scared, with wide eyes. His body is angled towards Shaggy, as if seeking reassurance, and his front legs are slightly bent, giving him a tense stance.
Next to Scooby Doo on the right is Fred Jones.Fred is wearing his typical white long-sleeved shirt with a blue collar and a red ascot. He has blue pants and brown shoes.
Fred is confidently pointing forward with his right hand. His left arm is around Scooby-Doo, holding him close, as if guiding or directing the group. He looks determined and alert, possibly indicating that he sees something in the distance.
Far right, the last person on the right side next to Fred is Daphne Blake. Daphne is wearing her iconic purple dress with a green scarf around her neck. She also has pink tights and purple shoes with light purple socks. Her headband is also purple, matching her dress.
Daphne is turned slightly towards the group with her arms positioned as if startled or in reaction to something. Her left hand is close to her face, and her right hand is raised, suggesting that she is surprised or reacting to the situation Fred is pointing at.
General Composition:
The characters are lined up in a group, all seemingly reacting to something happening off-frame. The expressions and body language suggest a mix of fear, caution, and leadership, typical of their dynamic in the show. Fred is leading the charge, while Velma, Shaggy, and Daphne appear more cautious or startled. Scooby-Doo, as usual, is looking nervous and sticking close to Shaggy and Fred.
There is no specific background in this image—it's just a plain white or transparent background, which makes the characters the sole focus.
TASK: DO NOT MENTION THAT YOU HAVE A DESCRIPTION. But use it to answer the user's question: ${context.messages[context.messages.length - 1].content}. 
      ANSWER THE QUESTION AND ASK ANOTHER QUESTION. DO NOT ASK ABOUT THE SAME THING MORE THAN ONCE. Please refrain from using emojis.
`  }],})  ,
    onDone : {
      target: "AnswerImageOne",
      actions: [
        ({ event }) => console.log(event.output.message.content),
        assign(({ context, event }) => {
          return {
            messages: [
              ...context.messages,
              {
                role: "assistant",
                content: event.output.message.content, // Response from the model
              },
            ],
          };
        }),
      ],
    },
  },
  },





thediscImagetwo: {invoke: {
  src: "LMactor",
  input: ({context}) => ({prompt: [{role: "user", 
    content: `DESCRIPTION OF THE IMAGE: 
    The image shows a group of well-known cartoon characters running together in a playful manner. 
    From left to right, the characters are: 
    Goofy - Wearing his usual orange turtleneck, blue pants, and a green hat, Goofy is running energetically with a big smile on his face. 
    Donald Duck - Dressed in his blue sailor outfit and red bow tie, Donald is running with a slightly determined look. 
    Daisy Duck - In her signature pink bow, lavender dress, and matching shoes, Daisy is running cheerfully alongside the others. 
    Minnie Mouse - Wearing her classic polka-dotted blue skirt and red bow, Minnie runs with a joyful expression. 
    Pluto - Mickey's pet dog Pluto is sprinting with his long ears flapping as he runs excitedly. 
    Mickey Mouse - At the far right, Mickey is leading the group, running happily in his red shorts and yellow shoes. 
    The background is a simple teal color, emphasizing the playful and dynamic movement of the characters. They all appear to be running in unison, creating a lively and fun atmosphere. 
    
  TASK: DO NOT MENTION THAT YOU HAVE A DESCRIPTION. But use it to answer the user's question: ${context.messages[context.messages.length - 1].content}. 
      ANSWER THE QUESTION AND ASK ANOTHER QUESTION. DO NOT ASK ABOUT THE SAME THING MORE THAN ONCE.Please refrain from using emojis`  }],}),
  onDone: {
    target: "AnswerImageTwo",
    actions: [
      ({ event }) => console.log(event.output.message.content),
      assign(({ context, event }) => {
        return {
          messages: [
            ...context.messages,
            {
              role: "assistant",
              content: event.output.message.content, // Response from the model
            },
          ],
        };
      }),
    ],
  },},},


  thediscImagethree: {invoke: {
    src: "LMactor",
    input: ({context}) => ({prompt: [{role: "user", 
      content: 
      `DESCRIPTION OF THE IMAGE: 
      The image depicts a vibrant Parisian street scene with the Eiffel Tower prominently in the background. Here's a detailed description of what can be seen:
      Background: Center-Right: The Eiffel Tower is positioned in the center-right of the image. It rises above the buildings and trees in the background, providing a focal point.
Sky: The sky above is bright, and no clouds are visible. The lighting suggests it's either dusk or late afternoon, with the beginning of artificial lights illuminating the scene.
Midground (Buildings and Street): Left: On the left side of the image, you can see a row of buildings. These buildings have multiple floors with yellowish-orange light glowing from their windows. The upper portions of these buildings have European-style architecture with sloped roofs and chimneys.
Right: On the right side of the image, there are more buildings but they are partially hidden by trees and market stalls. The buildings have similar yellow lighting in their windows, adding warmth to the scene.
Street: The wet cobblestone street runs down the center of the image, reflecting the street lights and the colors of the market stalls. The street gives the image a sense of depth and perspective as it recedes into the distance toward the Eiffel Tower.
Foreground (Flower Stalls and Market): Left (foreground): In the lower-left corner, there is a flower stall covered by a blue-and-white striped awning. Below it, there are pots of colorful flowers in vibrant shades of red, pink, and yellow. The stall is rich in floral diversity, giving the scene color and life.
Center: In the lower-center, more flower pots and smaller market stalls are visible, displaying a variety of flowers. A pathway between the stalls leads further into the image, guiding the eye toward the Eiffel Tower.
Right (foreground): On the lower-right side, there is another flower stall with a red awning. This stall, like the one on the left, has an assortment of flowers in pots arranged in a semi-circle, creating a symmetrical balance with the stall on the left. The red awning provides a strong contrast to the blue and purple tones seen elsewhere in the image.
The stalls and flowers add a burst of color to the otherwise subdued tones of the buildings and street.
People and Activity: Throughout the street scene, there are small figures of people walking or shopping, though they are not in sharp focus. They add movement to the scene, but they are not prominent.
The people are mostly in the midground, suggesting casual activity and enhancing the bustling yet relaxed atmosphere of the Paris street.
Lighting and Reflections: Street lamps are scattered throughout the scene, primarily positioned along the street and near the market stalls. They emit a warm, golden glow.
The wet street reflects the lights from the stalls and lamps, creating a shimmering effect, especially in the center of the image, adding depth and highlighting the after-rain ambiance.
TASK: DO NOT MENTION THAT YOU HAVE A DESCRIPTION. But use it to answer the user's question: ${context.messages[context.messages.length - 1].content}. 
      ANSWER THE QUESTION AND ASK ANOTHER QUESTION. DO NOT ASK ABOUT THE SAME THING MORE THAN ONCE.Please refrain from using emojis`  }],}),
    onDone: {
      target: "AnswerImageThree",
      actions: [
        ({ event }) => console.log(event.output.message.content),
        assign(({ context, event }) => {
          return {
            messages: [
              ...context.messages,
              {
                role: "assistant",
                content: event.output.message.content, 
              },
            ],
          };
        }),
      ],
    },},},




thediscImagefour: {invoke: {
  src: "LMactor",
  input: ({context}) => ({prompt: [{role: "user", 
    content: `DESCRIPTION OF THE IMAGE: 
    In "Las Meninas", the characters are arranged throughout the room in a way that creates depth and hierarchy:
Infanta Margarita Teresa is positioned at the center of the painting, slightly forward. She has blonde hair and she is the focal point, standing calmly, dressed in a bright gown, drawing the viewer's immediate attention.
The Maids of Honor (Meninas):
One maid, Isabel de Velasco, is to the left (your right) of the Infanta, standing and looking towards her.
The other maid, María Agustina Sarmiento, kneels on the right (your left), offering the Infanta a drink from a tray.
The Dwarfs: María Bárbola, the female dwarf, stands to the right (your left) of the Infanta, closer to the foreground.
Nicolasito Pertusato, the male dwarf, is playfully nudging a large dog lying in the lower right foreground.
Velázquez himself is standing on the left side (your right) of the painting, near the front. He is seen in the act of painting, standing next to a large canvas that faces away from the viewer, adding to the mystery of what he’s painting. He looks out toward the viewer or possibly at the royal couple.
Doña Marcela de Ulloa, the chaperone in mourning, is behind the Infanta and the dwarfs, slightly to the right, standing with a male guard who is barely visible. She stands further back in the room.
José Nieto Velázquez, the queen’s chamberlain, is positioned in the doorway at the back of the room. He is illuminated by the light coming from outside, creating a sense of depth and drawing the viewer’s eye to the background.
The Mirror on the back wall reflects the images of King Philip IV and Queen Mariana, suggesting that they are outside the scene, observing the figures in the room. Their reflection implies they are standing where the viewer might be, further blurring the boundaries between the real and the depicted world.
The room itself is large, with soft light entering from the right side, illuminating the figures. The open door and mirror in the background add to the spatial complexity and make the room feel more expansive. The placement of the figures creates a natural, dynamic composition, with interactions between the foreground and background.
TASK: DO NOT MENTION THAT YOU HAVE A DESCRIPTION. But use it to answer the user's question: ${context.messages[context.messages.length - 1].content}. 
      ANSWER THE QUESTION AND ASK ANOTHER QUESTION. DO NOT ASK ABOUT THE SAME THING MORE THAN ONCE.Please refrain from using emojis`  }],}),
  onDone: {
    target: "AnswerImageFour",
    actions: [
      ({ event }) => console.log(event.output.message.content),
      assign(({ context, event }) => {
        return {
          messages: [
            ...context.messages,
            {
              role: "assistant",
              content: event.output.message.content, 
            },
          ],
        };
      }),
    ],
  },},},







    },
  },
  Done: {
    on: {
        CLICK: "PromptAndAsk"
    }
},
}
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  /* if you want to log some parts of the state */
  console.debug(state.context);
});

export function setupButton(element: any) { 
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    const meta = Object.values(snapshot.getMeta())[0];
    element.innerHTML = `${(meta as any).view}`;
  });
}



const introPage = document.getElementById('introPage')!;
const startButton = document.getElementById('startButton')!;
const categoryPage = document.getElementById('categoryPage')!;
const cartoonButton = document.getElementById('cartoonButton')!;
const paintingButton = document.getElementById('paintingButton')!;
const cartoonOptions = document.getElementById('cartoonOptions')!;
const paintingOptions = document.getElementById('paintingOptions')!;

startButton.addEventListener('click', () => {
  introPage.style.display = 'none';          
  categoryPage.style.display = 'block';      
});

cartoonButton.addEventListener('click', () => {
  categoryPage.style.display = 'none';        
  cartoonOptions.style.display = 'block';     
  paintingOptions.style.display = 'none';     
});

paintingButton.addEventListener('click', () => {
  categoryPage.style.display = 'none';        
  paintingOptions.style.display = 'block';    
  cartoonOptions.style.display = 'none';     
});

document.getElementById('cartoonButton')?.addEventListener('click', () => {
  dmActor.send({ type: 'ClickCartoons' });
});

document.getElementById('paintingButton')?.addEventListener('click', () => {
  dmActor.send({ type: 'ClickPaintings' });
});

//MEXRI EDO 
document.getElementById('Scoobydoo')?.addEventListener('click', () => {
  dmActor.send({ type: 'ClickImage1' });
});
document.getElementById('Mickeymouse')?.addEventListener('click', () => {
  dmActor.send({ type: 'ClickImage2' });
});
document.getElementById('Paris')?.addEventListener('click', () => {
  dmActor.send({ type: 'ClickImage3' });
});
document.getElementById('Lasmeninas')?.addEventListener('click', () => {
  dmActor.send({ type: 'ClickImage4' });
});




window.onload = function () {
  const startButtonDiv = document.getElementById("startButton")
  const selectOptionsDiv = document.getElementById("selectOptions")
  
  //setupSelect(selectOptionsDiv);
  setupButton(startButtonDiv);
  
};   