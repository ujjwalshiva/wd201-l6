"use strict";
const { Model, Op } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Todo.belongsTo(models.User, {
        foreignKey: "userId",
      });
    }

    static addTodo({ title, dueDate, userId }) {
      return this.create({
        title: title,
        dueDate: dueDate,
        completed: false,
        userId,
      });
    }

    static getTodos(userId) {
      return this.findAll({
        order: [["id", "ASC"]],
        where: {
          userId,
        },
      });
    }

    static overdue(userId) {
      return this.findAll({
        where: {
          userId,
          completed: false,
          dueDate: {
            [Op.lt]: new Date(),
          },
        },
      });
    }

    static dueToday(userId) {
      return this.findAll({
        where: {
          userId,
          completed: false,
          dueDate: {
            [Op.eq]: new Date(),
          },
        },
      });
    }

    static dueLater(userId) {
      return this.findAll({
        where: {
          userId,
          completed: false,
          dueDate: {
            [Op.gt]: new Date(),
          },
        },
      });
    }

    static completed(userId) {
      return this.findAll({
        where: {
          userId,
          completed: true,
        },
      });
    }

    removeTodo(userId) {
      if (this.userId === userId) {
        return this.destroy();
      } else {
        throw new Error("Unauthorized");
      }
    }

    setCompletionStatus(completed, userId) {
      if (this.userId === userId) {
        return this.update({
          completed,
        });
      } else {
        throw new Error("Unauthorized");
      }
    }
  }
  Todo.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Title is required",
          },
          notEmpty: {
            msg: "Title is required",
          },
        },
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Due date is required",
          },
          notEmpty: {
            msg: "Due date is required",
          },
        },
      },
      completed: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Todo",
    }
  );
  return Todo;
};
