import {
    MechanicField
} from "./mechanics.service.js";


export function buildMechanicQuestion(
    field: MechanicField
): string {

    switch (field.type) {

        case "select":

        case "select-card": {

            const options =
                field.options
                    ?.map(
                        option =>
                            option.value
                    )
                    .join(", ");


            return (
                `Choose ${field.label}: ` +
                `${options}.`
            );
        }


        case "boolean":

            return (
                `${field.label}? ` +
                `Please answer yes or no.`
            );


        case "multiselect-card": {

            const options =
                field.options
                    ?.map(
                        option =>
                            option.value
                    )
                    .join(", ");


            return (
                `Choose one or more ` +
                `${field.label}: ${options}.`
            );
        }


        case "textarea":

            return (
                `Please enter ${field.label}.`
            );


        default:

            return (
                `Please provide ${field.label}.`
            );
    }
}